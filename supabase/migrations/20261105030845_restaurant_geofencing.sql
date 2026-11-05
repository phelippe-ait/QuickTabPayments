-- =====================================================================
-- Restaurant location storage and 500 m customer order geofence
-- =====================================================================

create table if not exists public.restaurant_locations (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  latitude double precision not null check (latitude >= -90 and latitude <= 90),
  longitude double precision not null check (longitude >= -180 and longitude <= 180),
  label text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_restaurant_locations_updated_at on public.restaurant_locations;
create trigger trg_restaurant_locations_updated_at
  before update on public.restaurant_locations
  for each row execute function public.set_updated_at();

alter table public.restaurant_locations enable row level security;
revoke all on table public.restaurant_locations from anon, authenticated;
grant select, insert, update, delete on table public.restaurant_locations to authenticated;

drop policy if exists "restaurant_locations_staff_read" on public.restaurant_locations;
drop policy if exists "restaurant_locations_staff_insert" on public.restaurant_locations;
drop policy if exists "restaurant_locations_staff_update" on public.restaurant_locations;
drop policy if exists "restaurant_locations_staff_delete" on public.restaurant_locations;

create policy "restaurant_locations_staff_read"
  on public.restaurant_locations for select to authenticated
  using (public.is_staff_of(restaurant_id));

create policy "restaurant_locations_staff_insert"
  on public.restaurant_locations for insert to authenticated
  with check (public.is_staff_of(restaurant_id));

create policy "restaurant_locations_staff_update"
  on public.restaurant_locations for update to authenticated
  using (public.is_staff_of(restaurant_id))
  with check (public.is_staff_of(restaurant_id));

create policy "restaurant_locations_staff_delete"
  on public.restaurant_locations for delete to authenticated
  using (public.is_staff_of(restaurant_id));

-- Replace the old callable signature so every order must include a location.
drop function if exists public.place_order(text, text, text, text, jsonb);

create or replace function public.place_order(
  p_restaurant_slug text,
  p_table_token     text,
  p_customer_name   text,
  p_notes           text default null,
  p_items           jsonb default '[]'::jsonb,
  p_customer_latitude  double precision default null,
  p_customer_longitude double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id   uuid;
  v_restaurant_name text;
  v_currency        text;
  v_timezone        text;
  v_tax_rate        numeric;
  v_restaurant_latitude  double precision;
  v_restaurant_longitude double precision;
  v_distance_m          double precision;
  v_table_id        uuid;
  v_table_number    text;
  v_expected_lines  int;
  v_valid_lines     int;
  v_lines           jsonb;
  v_total           numeric;
  v_tax             numeric;
  v_subtotal        numeric;
  v_tax_raw         numeric;
  v_prep_minutes    int;
  v_order_id        uuid;
  v_tracking_token  text;
  v_order_number    text;
  v_day             text;
  v_seq             int;
  v_attempt         int := 0;
  v_pickup_estimate timestamptz;
begin
  -- -----------------------------------------------------------------
  -- Input validation
  -- -----------------------------------------------------------------
  if p_customer_latitude is null or p_customer_longitude is null then
    raise exception 'customer_location_required' using errcode = 'P0001';
  end if;

  if p_customer_latitude < -90 or p_customer_latitude > 90
     or p_customer_longitude < -180 or p_customer_longitude > 180 then
    raise exception 'customer_location_invalid' using errcode = 'P0001';
  end if;

  if p_customer_name is null or length(btrim(p_customer_name)) = 0 then
    raise exception 'customer_name_required' using errcode = 'P0001';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as e
    where e->>'menu_item_id' is null
       or (e->>'menu_item_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'invalid_item' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as e
    where e->>'quantity' is null
       or (e->>'quantity') !~ '^[0-9]+$'
       or (e->>'quantity')::int <= 0
  ) then
    raise exception 'invalid_quantity' using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------
  -- Resolve restaurant + table (rejects cross-restaurant tokens and
  -- deactivated tables/restaurants)
  -- -----------------------------------------------------------------
  select r.id, r.name, r.currency, r.timezone, r.tax_rate
    into v_restaurant_id, v_restaurant_name, v_currency, v_timezone, v_tax_rate
  from public.restaurants r
  where r.slug = p_restaurant_slug
    and r.is_active
  limit 1;

  if v_restaurant_id is null then
    raise exception 'restaurant_not_found' using errcode = 'P0001';
  end if;

  select t.id, t.table_number
    into v_table_id, v_table_number
  from public.tables t
  where t.qr_token = p_table_token
    and t.restaurant_id = v_restaurant_id
    and t.is_active
  limit 1;

  if v_table_id is null then
    raise exception 'table_not_found' using errcode = 'P0001';
  end if;

  select rl.latitude, rl.longitude
    into v_restaurant_latitude, v_restaurant_longitude
  from public.restaurant_locations rl
  where rl.restaurant_id = v_restaurant_id;

  if v_restaurant_latitude is null or v_restaurant_longitude is null then
    raise exception 'restaurant_location_not_configured' using errcode = 'P0001';
  end if;

  -- Haversine great-circle distance in metres. Coordinates are not persisted.
  v_distance_m := 6371000 * 2 * asin(least(1, sqrt(
      power(sin(radians(p_customer_latitude - v_restaurant_latitude) / 2), 2)
      + cos(radians(v_restaurant_latitude))
        * cos(radians(p_customer_latitude))
        * power(sin(radians(p_customer_longitude - v_restaurant_longitude) / 2), 2)
    )));

  if v_distance_m > 500 then
    raise exception 'outside_ordering_radius' using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------
  -- Validate every menu item belongs to this restaurant and is available.
  -- Duplicate menu_item_id rows are folded into one line.
  -- -----------------------------------------------------------------
  select count(distinct (e->>'menu_item_id')::uuid)
    into v_expected_lines
  from jsonb_array_elements(p_items) as e;

  select count(*)
    into v_valid_lines
  from (
    select (e->>'menu_item_id')::uuid as menu_item_id
    from jsonb_array_elements(p_items) as e
    group by 1
  ) as wanted
  join public.menu_items mi
    on mi.id = wanted.menu_item_id
   and mi.restaurant_id = v_restaurant_id
   and mi.is_available;

  if v_valid_lines <> v_expected_lines then
    raise exception 'menu_item_unavailable' using errcode = 'P0001';
  end if;

  -- Server-side pricing. The client price is never read.
  select
    jsonb_agg(
      jsonb_build_object(
        'menu_item_id', priced.menu_item_id,
        'name',         priced.name,
        'quantity',     priced.quantity,
        'unit_price',   priced.unit_price,
        'subtotal',     priced.line_subtotal
      )
      order by priced.display_order, priced.name
    ),
    round(coalesce(sum(priced.line_subtotal), 0), 2),
    max(priced.prep_time_minutes)
  into v_lines, v_total, v_prep_minutes
  from (
    select
      mi.id                as menu_item_id,
      mi.name              as name,
      mi.display_order     as display_order,
      mi.prep_time_minutes as prep_time_minutes,
      sum((e->>'quantity')::int) as quantity,
      mi.price             as unit_price,
      round(mi.price * sum((e->>'quantity')::int), 2) as line_subtotal
    from jsonb_array_elements(p_items) as e
    join public.menu_items mi
      on mi.id = (e->>'menu_item_id')::uuid
     and mi.restaurant_id = v_restaurant_id
     and mi.is_available
    group by mi.id, mi.name, mi.display_order, mi.prep_time_minutes, mi.price
  ) as priced;

  -- GST-inclusive split: total is what the customer pays.
  v_total    := round(coalesce(v_total, 0), 2);
  v_tax_raw  := v_total * v_tax_rate / (1 + v_tax_rate);
  v_tax      := round(v_tax_raw, 2);
  v_subtotal := round(v_total - v_tax, 2);

  v_pickup_estimate := now()
    + (coalesce(v_prep_minutes, 0) || ' minutes')::interval;

  -- -----------------------------------------------------------------
  -- Insert the order + items. Retry the daily order number on collision.
  -- -----------------------------------------------------------------
  v_day := to_char(now() at time zone v_timezone, 'YYMMDD');

  select count(*) + 1
    into v_seq
  from public.orders o
  where o.restaurant_id = v_restaurant_id
    and o.order_number like 'QT-' || v_day || '-%';

  loop
    v_attempt := v_attempt + 1;
    v_order_number := 'QT-' || v_day || '-' ||
      lpad((v_seq + v_attempt - 1)::text, 4, '0');

    begin
      insert into public.orders (
        restaurant_id,
        table_id,
        customer_id,
        customer_name_snapshot,
        order_number,
        status,
        subtotal,
        tax,
        total,
        notes,
        pickup_time_estimate
      )
      values (
        v_restaurant_id,
        v_table_id,
        auth.uid(),                        -- null for guests
        btrim(p_customer_name),
        v_order_number,
        'confirmed'::public.order_status,  -- payment is Phase 6; order is placed
        v_subtotal,
        v_tax,
        v_total,
        nullif(btrim(coalesce(p_notes, '')), ''),
        v_pickup_estimate
      )
      returning id, tracking_token
      into v_order_id, v_tracking_token;

      exit;
    exception
      when unique_violation then
        if v_attempt >= 5 then
          raise exception 'order_number_conflict' using errcode = 'P0001';
        end if;
    end;
  end loop;

  insert into public.order_items (
    order_id,
    menu_item_id,
    item_name_snapshot,
    unit_price_snapshot,
    quantity,
    subtotal
  )
  select
    v_order_id,
    (line->>'menu_item_id')::uuid,
    line->>'name',
    (line->>'unit_price')::numeric,
    (line->>'quantity')::int,
    (line->>'subtotal')::numeric
  from jsonb_array_elements(v_lines) as line;

  return jsonb_build_object(
    'order_id',            v_order_id,
    'order_number',        v_order_number,
    'tracking_token',      v_tracking_token,
    'status',              'confirmed',
    'subtotal',            v_subtotal,
    'tax',                 v_tax,
    'total',               v_total,
    'currency',            v_currency,
    'restaurant_name',     v_restaurant_name,
    'table_number',        v_table_number,
    'pickup_time_estimate', v_pickup_estimate,
    'created_at',          now(),
    'items',               v_lines
  );
end;
$$;

revoke all on function public.place_order(text, text, text, text, jsonb, double precision, double precision) from public;
grant execute on function public.place_order(text, text, text, text, jsonb, double precision, double precision)
  to anon, authenticated;
