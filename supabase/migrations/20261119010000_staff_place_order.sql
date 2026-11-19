-- =====================================================================
-- Staff-assisted ordering (counter / table service)
-- ---------------------------------------------------------------------
-- Customers who order in person need a staff-facing way to create the
-- order. This RPC is the only writer for that journey.
--
--   * SECURITY DEFINER + explicit active-staff verification.
--   * `p_table_id` is optional: null means a counter / no-table order.
--   * Reuses the exact `place_order` validation and GST-inclusive pricing
--     rules (menu availability, modifier ownership, required/min/max,
--     server-side prices and snapshots).
--   * Orders are inserted as `confirmed` because staff have taken the
--     order in person; there is no Stripe PaymentIntent to wait for.
--   * `p_paid` records a payment collected at the counter (cash/terminal).
--     When false, no payment row is written and the order stays
--     "not recorded" rather than pretending money was captured.
--
-- Safe to re-run.
-- =====================================================================

create or replace function public.staff_place_order(
  p_table_id      uuid default null,
  p_customer_name text default null,
  p_notes         text default null,
  p_items         jsonb default '[]'::jsonb,
  p_paid          boolean default false
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
  v_line            jsonb;
  v_order_item_id   uuid;
begin
  -- -----------------------------------------------------------------
  -- Caller verification. A table id is optional (counter order), but
  -- either way the caller must be active staff of that restaurant.
  -- -----------------------------------------------------------------
  if auth.uid() is null then
    raise exception 'not_authorised' using errcode = 'P0001';
  end if;

  if p_table_id is not null then
    select t.id, t.table_number, t.restaurant_id
      into v_table_id, v_table_number, v_restaurant_id
    from public.tables t
    where t.id = p_table_id
      and t.is_active
    limit 1;

    if v_table_id is null then
      raise exception 'table_not_found' using errcode = 'P0001';
    end if;

    if not public.is_staff_of(v_restaurant_id) then
      raise exception 'not_authorised' using errcode = 'P0001';
    end if;
  else
    select r.id
      into v_restaurant_id
    from public.restaurant_staff rs
    join public.restaurants r on r.id = rs.restaurant_id
    where rs.user_id = auth.uid()
      and rs.is_active
      and r.is_active
    order by r.created_at, r.id
    limit 1;

    if v_restaurant_id is null then
      raise exception 'not_authorised' using errcode = 'P0001';
    end if;
  end if;

  select r.name, r.currency, r.timezone, r.tax_rate
    into v_restaurant_name, v_currency, v_timezone, v_tax_rate
  from public.restaurants r
  where r.id = v_restaurant_id
    and r.is_active;

  if v_restaurant_name is null then
    raise exception 'not_authorised' using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------
  -- Input validation (mirrors place_order)
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

  -- `modifiers` is optional; when supplied it must be an array of uuids.
  if exists (
    select 1
    from jsonb_array_elements(p_items) as e
    where e ? 'modifiers' and jsonb_typeof(e->'modifiers') <> 'array'
  ) then
    raise exception 'invalid_item' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as e
    cross join lateral jsonb_array_elements_text(coalesce(e->'modifiers', '[]'::jsonb)) as selected(value)
    where selected.value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'invalid_item' using errcode = 'P0001';
  end if;

  -- The same modifier may not be chosen twice on one line.
  if exists (
    select 1
    from jsonb_array_elements(p_items) as e
    where jsonb_array_length(coalesce(e->'modifiers', '[]'::jsonb)) <> (
      select count(distinct selected.value)
      from jsonb_array_elements_text(coalesce(e->'modifiers', '[]'::jsonb)) as selected(value)
    )
  ) then
    raise exception 'invalid_modifier' using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------
  -- Validate every menu item belongs to this restaurant and is available.
  -- Lines are keyed by (menu_item_id, sorted modifier ids) so identical
  -- choices fold together while different variants stay separate.
  -- -----------------------------------------------------------------
  select count(*)
    into v_expected_lines
  from (
    select distinct
      (e->>'menu_item_id')::uuid as menu_item_id,
      array(
        select selected.value::uuid
        from jsonb_array_elements_text(coalesce(e->'modifiers', '[]'::jsonb)) as selected(value)
        order by selected.value
      ) as modifier_key
    from jsonb_array_elements(p_items) as e
  ) as wanted;

  select count(*)
    into v_valid_lines
  from (
    select distinct
      (e->>'menu_item_id')::uuid as menu_item_id,
      array(
        select selected.value::uuid
        from jsonb_array_elements_text(coalesce(e->'modifiers', '[]'::jsonb)) as selected(value)
        order by selected.value
      ) as modifier_key
    from jsonb_array_elements(p_items) as e
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
    cross join lateral jsonb_array_elements_text(coalesce(e->'modifiers', '[]'::jsonb)) as selected(value)
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

  -- A required group must have at least one choice.
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
      from jsonb_array_elements_text(coalesce(e->'modifiers', '[]'::jsonb)) as selected(value)
      join public.modifiers m
        on m.id = selected.value::uuid
       and m.modifier_group_id = g.id
       and m.is_available
    ) chosen
    where g.is_required
      and chosen.selected_count = 0
  ) then
    raise exception 'modifier_required' using errcode = 'P0001';
  end if;

  -- Enforce each linked group's min/max rules on the server too.
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
      from jsonb_array_elements_text(coalesce(e->'modifiers', '[]'::jsonb)) as selected(value)
      join public.modifiers m
        on m.id = selected.value::uuid
       and m.modifier_group_id = g.id
       and m.is_available
    ) chosen
    where (g.selection_type = 'single'
             and (chosen.selected_count > 1
                  or chosen.selected_count < g.min_selections))
       or (g.selection_type <> 'single'
             and (chosen.selected_count < g.min_selections
                  or (g.max_selections > 0
                      and chosen.selected_count > g.max_selections)))
  ) then
    raise exception 'modifier_selection_invalid' using errcode = 'P0001';
  end if;

  -- Price each grouped cart line from live database values.
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
      grouped.line_order,
      grouped.quantity,
      round(mi.price + selected.adjustment, 2) as unit_price,
      round(round(mi.price + selected.adjustment, 2) * grouped.quantity, 2) as line_subtotal,
      selected.modifiers
    from (
      select
        (e.value->>'menu_item_id')::uuid as menu_item_id,
        array(
          select selected.value::uuid
          from jsonb_array_elements_text(coalesce(e.value->'modifiers', '[]'::jsonb)) as selected(value)
          order by selected.value
        ) as modifier_key,
        sum((e.value->>'quantity')::int)::int as quantity,
        min(e.ordinality) as line_order
      from jsonb_array_elements(p_items) with ordinality as e(value, ordinality)
      group by 1, 2
    ) as grouped
    join public.menu_items mi
      on mi.id = grouped.menu_item_id
     and mi.restaurant_id = v_restaurant_id
     and mi.is_available
    cross join lateral (
      select
        coalesce((
          select sum(m.price_adjustment)
          from public.modifiers m
          where m.id = any(grouped.modifier_key)
            and m.is_available
        ), 0) as adjustment,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'modifier_id', m.id,
            'name', m.name,
            'price_adjustment', m.price_adjustment
          ) order by m.display_order, m.name)
          from public.modifiers m
          where m.id = any(grouped.modifier_key)
            and m.is_available
        ), '[]'::jsonb) as modifiers
    ) as selected
  ) as priced;

  -- GST-inclusive split: total is what the guest pays at the counter.
  v_total    := round(coalesce(v_total, 0), 2);
  v_tax_raw  := v_total * v_tax_rate / (1 + v_tax_rate);
  v_tax      := round(v_tax_raw, 2);
  v_subtotal := round(v_total - v_tax, 2);

  v_pickup_estimate := now()
    + (coalesce(v_prep_minutes, 0) || ' minutes')::interval;

  -- -----------------------------------------------------------------
  -- Insert the order + items. Retry the daily order number on collision.
  -- Staff orders are `confirmed` immediately: there is no online payment
  -- step to wait for before the kitchen can start.
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
        null,                              -- staff-created, not a customer account
        btrim(p_customer_name),
        v_order_number,
        'confirmed'::public.order_status,
        v_subtotal,
        v_tax,
        v_total,
        0,
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

  -- Each priced line carries its own modifier snapshots.
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

  -- Optional: money collected at the counter (cash or external terminal).
  -- Without this, the order remains honestly "no payment recorded".
  if coalesce(p_paid, false) then
    insert into public.payments (
      order_id,
      status,
      amount,
      currency,
      payment_method_type,
      paid_at
    )
    values (
      v_order_id,
      'succeeded',
      v_total,
      v_currency,
      'other',
      now()
    );
  end if;

  return jsonb_build_object(
    'order_id',             v_order_id,
    'order_number',         v_order_number,
    'tracking_token',       v_tracking_token,
    'status',               'confirmed',
    'subtotal',             v_subtotal,
    'tax',                  v_tax,
    'total',                v_total,
    'tip_amount',           0,
    'currency',             v_currency,
    'restaurant_name',      v_restaurant_name,
    'table_number',         v_table_number,
    'customer_name',        btrim(p_customer_name),
    'paid',                 coalesce(p_paid, false),
    'pickup_time_estimate', v_pickup_estimate,
    'created_at',           now(),
    'items',                v_lines
  );
end;
$$;

revoke all on function public.staff_place_order(uuid, text, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.staff_place_order(uuid, text, text, jsonb, boolean)
  to authenticated;

comment on function public.staff_place_order(uuid, text, text, jsonb, boolean) is
  'Staff-facing counter/table order creation: active-staff only, server-priced, validated modifiers, confirmed immediately, optional counter payment record.';
