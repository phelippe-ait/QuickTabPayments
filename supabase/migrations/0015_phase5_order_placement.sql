-- =====================================================================
-- QuickTab — Phase 5 order placement + guest tracking (0015)
-- ---------------------------------------------------------------------
-- Run AFTER 0014_restaurant_invites.sql.
--
-- Adds:
--   1. orders.tracking_token — opaque per-order secret for guest tracking.
--   2. public.place_order(...) — atomic, server-priced order placement.
--   3. public.get_order_tracking(...) — narrow, token-authorised tracking.
--
-- Design notes:
--   * GST-inclusive pricing. Menu prices are what the customer pays:
--       total    = round(Σ unit_price × qty, 2)
--       tax      = round(total × rate / (1 + rate), 2)
--       subtotal = total - tax
--   * The client only sends menu_item_id + quantity. Prices, names, tax and
--     totals are recomputed here; tampering with a client payload does nothing.
--   * place_order is SECURITY DEFINER so guests can write orders + order_items
--     in one transaction without widening order_items RLS.
--   * get_order_tracking is SECURITY DEFINER and returns only the limited
--     fields below. It never echoes the token and never exposes customer_id.
--   * orders_select_own_or_staff is intentionally untouched.
--
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. orders.tracking_token
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists tracking_token text;

-- Backfill existing rows with an independent random token per row. (A UUID
-- carries 122 random bits and avoids depending on pgcrypto's schema.)
update public.orders
   set tracking_token = replace(gen_random_uuid()::text, '-', '')
 where tracking_token is null;

alter table public.orders
  alter column tracking_token set default replace(gen_random_uuid()::text, '-', '');

alter table public.orders
  alter column tracking_token set not null;

create unique index if not exists uq_orders_tracking_token
  on public.orders(tracking_token);

comment on column public.orders.tracking_token is
  'Opaque guest tracking secret. Never expose in list responses; read through get_order_tracking().';

-- ---------------------------------------------------------------------
-- 2. place_order
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_restaurant_slug text,
  p_table_token     text,
  p_customer_name   text,
  p_notes           text default null,
  p_items           jsonb default '[]'::jsonb
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

revoke all on function public.place_order(text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. get_order_tracking
-- ---------------------------------------------------------------------
create or replace function public.get_order_tracking(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_token is null or length(btrim(p_token)) = 0 then
    return null;
  end if;

  select jsonb_build_object(
    'order_id',             o.id,
    'order_number',         o.order_number,
    'status',               o.status,
    'subtotal',             o.subtotal,
    'tax',                  o.tax,
    'total',                o.total,
    'currency',             r.currency,
    'created_at',           o.created_at,
    'pickup_time_estimate', o.pickup_time_estimate,
    'table_number',         t.table_number,
    'restaurant_name',      r.name,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name',       oi.item_name_snapshot,
            'quantity',   oi.quantity,
            'unit_price', oi.unit_price_snapshot,
            'subtotal',   oi.subtotal
          )
          order by oi.id
        )
        from public.order_items oi
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  left join public.tables t on t.id = o.table_id
  where o.tracking_token = btrim(p_token);

  return v_result;  -- null when no match; leaks nothing
end;
$$;

revoke all on function public.get_order_tracking(text) from public;
grant execute on function public.get_order_tracking(text)
  to anon, authenticated;

comment on function public.place_order(text, text, text, text, jsonb) is
  'Atomic guest/staff order placement with server-side GST-inclusive pricing.';

comment on function public.get_order_tracking(text) is
  'Token-authorised, read-only order tracking. Returns null for unknown tokens.';

-- ---------------------------------------------------------------------
-- 4. resolve_qr_context
-- ---------------------------------------------------------------------
-- Public QR resolution. Kept as an RPC, not a widened table policy, so anon
-- can distinguish "table deactivated" from "wrong restaurant" without being
-- able to enumerate tables.
create or replace function public.resolve_qr_context(
  p_slug  text,
  p_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant record;
  v_table      record;
begin
  if p_slug is null or p_token is null
     or length(btrim(p_slug)) = 0 or length(btrim(p_token)) = 0 then
    return jsonb_build_object('error', 'missing_params');
  end if;

  select r.id, r.slug, r.name, r.currency, r.tax_rate
    into v_restaurant
  from public.restaurants r
  where r.slug = btrim(p_slug)
    and r.is_active
  limit 1;

  if v_restaurant.id is null then
    return jsonb_build_object('error', 'restaurant_not_found');
  end if;

  select t.id, t.qr_token, t.table_number, t.is_active
    into v_table
  from public.tables t
  where t.qr_token = btrim(p_token)
    and t.restaurant_id = v_restaurant.id
  limit 1;

  if v_table.id is null then
    return jsonb_build_object('error', 'table_not_found');
  end if;

  if not v_table.is_active then
    return jsonb_build_object('error', 'table_inactive');
  end if;

  return jsonb_build_object(
    'restaurant_id',   v_restaurant.id,
    'restaurant_slug', v_restaurant.slug,
    'restaurant_name', v_restaurant.name,
    'currency',        v_restaurant.currency,
    'tax_rate',        v_restaurant.tax_rate,
    'table_id',        v_table.id,
    'table_token',     v_table.qr_token,
    'table_number',    v_table.table_number
  );
end;
$$;

revoke all on function public.resolve_qr_context(text, text) from public;
grant execute on function public.resolve_qr_context(text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------
