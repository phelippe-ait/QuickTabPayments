-- =====================================================================
-- P04 — order tips
-- ---------------------------------------------------------------------
-- Adds orders.tip_amount and teaches place_order to compute tips on the
-- server from an untrusted {type, value} payload.
--
-- Decision: the tip is added ON TOP of the GST-inclusive items total and
-- carries no additional GST (standard AU practice). orders.total stays the
-- items total; amount_due (= total + tip_amount) is what Stripe charges.
--
-- Safe to re-run.
-- =====================================================================

alter table public.orders
  add column if not exists tip_amount numeric(10,2) not null default 0;

comment on column public.orders.tip_amount is
  'Customer tip added on top of the GST-inclusive items total. The tip itself carries no GST; orders.total remains the items total.';

-- Adding a parameter creates a NEW overload, so the old signatures must be
-- dropped explicitly. The 5-arg version is the original from migration 0015;
-- the 7-arg version added the geofence coordinates. Drop both so PostgREST
-- cannot pick an ambiguous place_order.
drop function if exists public.place_order(text, text, text, text, jsonb);
drop function if exists public.place_order(text, text, text, text, jsonb, double precision, double precision);

create or replace function public.place_order(
  p_restaurant_slug text,
  p_table_token     text,
  p_customer_name   text,
  p_notes           text default null,
  p_items           jsonb default '[]'::jsonb,
  p_customer_latitude  double precision default null,
  p_customer_longitude double precision default null,
  p_tip             jsonb default null
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
  v_geofence_enabled boolean := false;
  v_distance_m          double precision;
  v_table_id        uuid;
  v_table_number    text;
  v_expected_lines  int;
  v_valid_lines     int;
  v_lines           jsonb;
  v_total           numeric;
  v_tax             numeric;
  v_subtotal        numeric;
  v_tip_amount      numeric := 0;
  v_amount_due      numeric;
  v_tip_value       numeric;
  v_tax_raw         numeric;
  v_prep_minutes    int;
  v_order_id        uuid;
  v_tracking_token  text;
  v_order_number    text;
  v_day             text;
  v_seq             int;
  v_attempt         int := 0;
  v_pickup_estimate timestamptz;
  v_line            jsonb;
  v_order_item_id   uuid;
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

  if exists (
    select 1
    from jsonb_array_elements(p_items) as e
    where e ? 'modifier_ids' and jsonb_typeof(e->'modifier_ids') <> 'array'
  ) then
    raise exception 'invalid_modifier' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as e
    cross join lateral jsonb_array_elements_text(coalesce(e->'modifier_ids', '[]'::jsonb)) as selected(value)
    where selected.value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) or exists (
    select 1
    from jsonb_array_elements(p_items) as e
    where jsonb_array_length(coalesce(e->'modifier_ids', '[]'::jsonb)) <> (
      select count(distinct selected.value)
      from jsonb_array_elements_text(coalesce(e->'modifier_ids', '[]'::jsonb)) as selected(value)
    )
  ) then
    raise exception 'invalid_modifier' using errcode = 'P0001';
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

  select rl.latitude, rl.longitude, coalesce(rl.geofence_enabled, false)
    into v_restaurant_latitude, v_restaurant_longitude, v_geofence_enabled
  from public.restaurant_locations rl
  where rl.restaurant_id = v_restaurant_id;

  if coalesce(v_geofence_enabled, false) then
    if p_customer_latitude is null or p_customer_longitude is null then
      raise exception 'customer_location_required' using errcode = 'P0001';
    end if;

    if p_customer_latitude < -90 or p_customer_latitude > 90
       or p_customer_longitude < -180 or p_customer_longitude > 180 then
      raise exception 'customer_location_invalid' using errcode = 'P0001';
    end if;

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
  end if;

  -- -----------------------------------------------------------------
  -- Validate every menu item belongs to this restaurant and is available.
  -- Each submitted cart row stays separate to preserve modifier variants.
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

  -- Modifier ids are untrusted: every choice must be available and linked
  -- to this item through one of its groups at this restaurant.
  if exists (
    select 1
    from jsonb_array_elements(p_items) as e
    cross join lateral jsonb_array_elements_text(coalesce(e->'modifier_ids', '[]'::jsonb)) as selected(value)
    left join public.modifiers m
      on m.id = selected.value::uuid
     and m.is_available
    left join public.menu_item_modifier_groups item_group
      on item_group.menu_item_id = (e->>'menu_item_id')::uuid
     and item_group.modifier_group_id = m.modifier_group_id
    left join public.modifier_groups g
      on g.id = item_group.modifier_group_id
     and g.restaurant_id = v_restaurant_id
    where m.id is null or item_group.menu_item_id is null or g.id is null
  ) then
    raise exception 'invalid_modifier' using errcode = 'P0001';
  end if;

  -- Enforce each linked group's required/min/max rules on the server too.
  if exists (
    select 1
    from jsonb_array_elements(p_items) as e
    join public.menu_item_modifier_groups item_group
      on item_group.menu_item_id = (e->>'menu_item_id')::uuid
    join public.modifier_groups g
      on g.id = item_group.modifier_group_id
     and g.restaurant_id = v_restaurant_id
    cross join lateral (
      select count(*)::int as selected_count
      from jsonb_array_elements_text(coalesce(e->'modifier_ids', '[]'::jsonb)) as selected(value)
      join public.modifiers m
        on m.id = selected.value::uuid
       and m.modifier_group_id = g.id
       and m.is_available
    ) chosen
    where chosen.selected_count < greatest(g.min_selections, case when g.is_required then 1 else 0 end)
       or chosen.selected_count > case when g.selection_type = 'single' then least(g.max_selections, 1) else g.max_selections end
  ) then
    raise exception 'invalid_modifier_selection' using errcode = 'P0001';
  end if;

  -- Price each submitted cart line from live database values. Distinct
  -- modifier combinations remain distinct order_items.
  select
    jsonb_agg(
      jsonb_build_object(
        'menu_item_id', priced.menu_item_id,
        'name',         priced.name,
        'quantity',     priced.quantity,
        'unit_price',   priced.unit_price,
        'subtotal',     priced.line_subtotal,
        'modifiers',    priced.modifiers
      ) order by priced.display_order, priced.name, priced.line_order
    ),
    round(coalesce(sum(priced.line_subtotal), 0), 2),
    max(priced.prep_time_minutes)
  into v_lines, v_total, v_prep_minutes
  from (
    select
      mi.id as menu_item_id,
      mi.name,
      mi.display_order,
      mi.prep_time_minutes,
      e.ordinality as line_order,
      (e.value->>'quantity')::int as quantity,
      greatest(0, mi.price + selected.adjustment) as unit_price,
      round(greatest(0, mi.price + selected.adjustment) * (e.value->>'quantity')::int, 2) as line_subtotal,
      selected.modifiers
    from jsonb_array_elements(p_items) with ordinality as e(value, ordinality)
    join public.menu_items mi
      on mi.id = (e.value->>'menu_item_id')::uuid
     and mi.restaurant_id = v_restaurant_id
     and mi.is_available
    cross join lateral (
      select
        coalesce(sum(m.price_adjustment), 0) as adjustment,
        coalesce(jsonb_agg(jsonb_build_object(
          'modifier_id', m.id,
          'name', m.name,
          'price_adjustment', m.price_adjustment
        ) order by m.display_order, m.name), '[]'::jsonb) as modifiers
      from jsonb_array_elements_text(coalesce(e.value->'modifier_ids', '[]'::jsonb)) as selected(value)
      join public.modifiers m
        on m.id = selected.value::uuid
       and m.is_available
    ) selected
  ) as priced;

  -- GST-inclusive split: total is what the customer pays.
  v_total    := round(coalesce(v_total, 0), 2);
  v_tax_raw  := v_total * v_tax_rate / (1 + v_tax_rate);
  v_tax      := round(v_tax_raw, 2);
  v_subtotal := round(v_total - v_tax, 2);

  -- Tip: computed here, never trusted from the client. The tip is added on
  -- top of the GST-inclusive items total and carries no additional GST.
  if p_tip is null or p_tip = 'null'::jsonb or p_tip = '{}'::jsonb then
    v_tip_amount := 0;
  elsif jsonb_typeof(p_tip) <> 'object' then
    raise exception 'invalid_tip' using errcode = 'P0001';
  elsif not (p_tip ? 'type') then
    raise exception 'invalid_tip' using errcode = 'P0001';
  elsif p_tip->>'type' = 'none' then
    v_tip_amount := 0;
  elsif p_tip->>'type' = 'percent' then
    if jsonb_typeof(p_tip->'value') is distinct from 'number' then
      raise exception 'invalid_tip' using errcode = 'P0001';
    end if;
    v_tip_value := (p_tip->>'value')::numeric;
    if v_tip_value < 0 or v_tip_value > 25 then
      raise exception 'invalid_tip' using errcode = 'P0001';
    end if;
    v_tip_amount := round(v_total * v_tip_value / 100, 2);
  elsif p_tip->>'type' = 'fixed' then
    if jsonb_typeof(p_tip->'value') is distinct from 'number' then
      raise exception 'invalid_tip' using errcode = 'P0001';
    end if;
    v_tip_value := (p_tip->>'value')::numeric;
    if v_tip_value < 0 or v_tip_value > 500 then
      raise exception 'invalid_tip' using errcode = 'P0001';
    end if;
    v_tip_amount := round(v_tip_value, 2);
  else
    raise exception 'invalid_tip' using errcode = 'P0001';
  end if;

  v_amount_due := round(v_total + v_tip_amount, 2);

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
        tip_amount,
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
        v_tip_amount,
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

  for v_line in select value from jsonb_array_elements(v_lines) as lines(value)
  loop
    insert into public.order_items (
      order_id,
      menu_item_id,
      item_name_snapshot,
      unit_price_snapshot,
      quantity,
      subtotal
    )
    values (
      v_order_id,
      (v_line->>'menu_item_id')::uuid,
      v_line->>'name',
      (v_line->>'unit_price')::numeric,
      (v_line->>'quantity')::int,
      (v_line->>'subtotal')::numeric
    )
    returning id into v_order_item_id;

    insert into public.order_item_modifiers (
      order_item_id,
      modifier_id,
      modifier_name_snapshot,
      price_adjustment_snapshot
    )
    select
      v_order_item_id,
      (modifier->>'modifier_id')::uuid,
      modifier->>'name',
      (modifier->>'price_adjustment')::numeric
    from jsonb_array_elements(v_line->'modifiers') as chosen(modifier);
  end loop;

  return jsonb_build_object(
    'order_id',            v_order_id,
    'order_number',        v_order_number,
    'tracking_token',      v_tracking_token,
    'status',              'confirmed',
    'subtotal',            v_subtotal,
    'tax',                 v_tax,
    'total',               v_total,
    'tip_amount',          v_tip_amount,
    'amount_due',          v_amount_due,
    'currency',            v_currency,
    'restaurant_name',     v_restaurant_name,
    'table_number',        v_table_number,
    'pickup_time_estimate', v_pickup_estimate,
    'created_at',          now(),
    'items',               v_lines
  );
end;
$$;

revoke all on function public.place_order(text, text, text, text, jsonb, double precision, double precision, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, jsonb, double precision, double precision, jsonb)
  to anon, authenticated;

comment on function public.place_order(text, text, text, text, jsonb, double precision, double precision, jsonb) is
  'Atomic guest/staff order placement with server-side GST-inclusive pricing and validated tips.';

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
    'tip_amount',           o.tip_amount,
    'currency',             r.currency,
    'created_at',           o.created_at,
    'pickup_time_estimate', o.pickup_time_estimate,
    'table_number',         t.table_number,
    'restaurant_name',      r.name,
    'payment_status',       latest_payment.status,
    'payment_method_type',  latest_payment.payment_method_type,
    'receipt_url',          latest_payment.receipt_url,
    'amount_paid',          coalesce((
      select sum(p.amount)
        from public.payments p
       where p.order_id = o.id
         and p.status in ('succeeded', 'refunded')
    ), 0),
    'refunded_total',       coalesce((
      select sum(rf.amount)
        from public.refunds rf
       where rf.order_id = o.id
         and rf.status = 'succeeded'
    ), 0),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name',       oi.item_name_snapshot,
            'quantity',   oi.quantity,
            'unit_price', oi.unit_price_snapshot,
            'subtotal',   oi.subtotal,
            'modifiers', coalesce((
              select jsonb_agg(jsonb_build_object(
                'name', oim.modifier_name_snapshot,
                'price_adjustment', oim.price_adjustment_snapshot
              ) order by oim.id)
              from public.order_item_modifiers oim
              where oim.order_item_id = oi.id
            ), '[]'::jsonb)
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
  left join lateral (
    select p.status, p.payment_method_type, p.receipt_url
      from public.payments p
     where p.order_id = o.id
     order by (p.status in ('succeeded', 'refunded')) desc, p.created_at desc
     limit 1
  ) as latest_payment on true
  where o.tracking_token = btrim(p_token);

  return v_result;  -- null when no match; leaks nothing
end;
$$;

revoke all on function public.get_order_tracking(text) from public;
grant execute on function public.get_order_tracking(text)
  to anon, authenticated;
