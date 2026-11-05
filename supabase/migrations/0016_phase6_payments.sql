-- =====================================================================
-- QuickTab — Phase 6 payments (0016)
-- ---------------------------------------------------------------------
-- Run AFTER 0015_phase5_order_placement.sql.
--
-- Adds:
--   1. place_order now creates `pending` orders (unpaid until the Stripe
--      webhook confirms them via apply_payment_succeeded).
--   2. record_payment_intent(...) — server-only write of the Stripe intent.
--   3. apply_payment_succeeded(...) — idempotent payment + order confirmation.
--   4. apply_payment_failed(...) — idempotent failure + pending-order cancel.
--   5. apply_refund_succeeded(...) — idempotent refund reconciliation.
--
-- All payment functions are SECURITY DEFINER and executable only by
-- service_role; the /api functions call them with the service-role key.
--
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. place_order — create orders as `pending`
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

  v_total    := round(coalesce(v_total, 0), 2);
  v_tax_raw  := v_total * v_tax_rate / (1 + v_tax_rate);
  v_tax      := round(v_tax_raw, 2);
  v_subtotal := round(v_total - v_tax, 2);

  v_pickup_estimate := now()
    + (coalesce(v_prep_minutes, 0) || ' minutes')::interval;

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
        'pending'::public.order_status,
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
    'status',              'pending',
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

comment on function public.place_order(text, text, text, text, jsonb) is
  'Phase 6: orders are created pending; the Stripe webhook confirms them via apply_payment_succeeded.';

-- ---------------------------------------------------------------------
-- 2. record_payment_intent
-- ---------------------------------------------------------------------
create or replace function public.record_payment_intent(
  p_order_id uuid,
  p_amount numeric,
  p_currency text,
  p_stripe_payment_intent_id text,
  p_method text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_method public.payment_method_type;
begin
  v_method := case p_method
    when 'card' then 'card'::public.payment_method_type
    when 'apple_pay' then 'apple_pay'::public.payment_method_type
    when 'google_pay' then 'google_pay'::public.payment_method_type
    else 'other'::public.payment_method_type
  end;

  insert into public.payments
    (order_id, amount, currency, status, stripe_payment_intent_id, payment_method_type)
  values
    (p_order_id, p_amount, lower(p_currency), 'pending', p_stripe_payment_intent_id, v_method)
  returning id into v_id;

  return v_id;
end; $$;

revoke all on function public.record_payment_intent(uuid,numeric,text,text,text) from public;
grant execute on function public.record_payment_intent(uuid,numeric,text,text,text) to service_role;

-- ---------------------------------------------------------------------
-- 3. apply_payment_succeeded
-- ---------------------------------------------------------------------
create or replace function public.apply_payment_succeeded(
  p_stripe_payment_intent_id text,
  p_receipt_url text default null,
  p_method text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments;
  v_method public.payment_method_type;
begin
  select * into v_payment from public.payments
   where stripe_payment_intent_id = p_stripe_payment_intent_id
   for update;

  if not found then return; end if;
  if v_payment.status = 'succeeded' then return; end if;

  v_method := case p_method
    when 'card' then 'card'::public.payment_method_type
    when 'apple_pay' then 'apple_pay'::public.payment_method_type
    when 'google_pay' then 'google_pay'::public.payment_method_type
    else coalesce(v_payment.payment_method_type, 'other'::public.payment_method_type)
  end;

  update public.payments
     set status = 'succeeded', paid_at = coalesce(paid_at, now()),
         receipt_url = coalesce(p_receipt_url, receipt_url),
         payment_method_type = v_method
   where id = v_payment.id;

  update public.orders
     set status = 'confirmed'
   where id = v_payment.order_id and status = 'pending';
end; $$;

revoke all on function public.apply_payment_succeeded(text,text,text) from public;
grant execute on function public.apply_payment_succeeded(text,text,text) to service_role;

-- ---------------------------------------------------------------------
-- 4. apply_payment_failed
-- ---------------------------------------------------------------------
create or replace function public.apply_payment_failed(
  p_stripe_payment_intent_id text,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments
   where stripe_payment_intent_id = p_stripe_payment_intent_id
   for update;

  if not found then return; end if;
  if v_payment.status in ('succeeded','refunded') then return; end if;

  update public.payments
     set status = 'failed', failure_reason = p_reason
   where id = v_payment.id;

  update public.orders
     set status = 'cancelled', completed_at = now()
   where id = v_payment.order_id and status = 'pending';
end; $$;

revoke all on function public.apply_payment_failed(text,text) from public;
grant execute on function public.apply_payment_failed(text,text) to service_role;

-- ---------------------------------------------------------------------
-- 5. apply_refund_succeeded
-- ---------------------------------------------------------------------
create or replace function public.apply_refund_succeeded(
  p_stripe_payment_intent_id text,
  p_stripe_refund_id text default null,
  p_amount numeric default null,
  p_full boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments;
begin
  if p_stripe_refund_id is not null then
    update public.refunds
       set status = 'succeeded'
     where stripe_refund_id = p_stripe_refund_id
       and status <> 'succeeded';
  end if;

  select * into v_payment from public.payments
   where stripe_payment_intent_id = p_stripe_payment_intent_id
   for update;

  if not found then return; end if;
  if p_full and v_payment.status = 'succeeded' then
    update public.payments set status = 'refunded' where id = v_payment.id;
  end if;
end; $$;

revoke all on function public.apply_refund_succeeded(text,text,numeric,boolean) from public;
grant execute on function public.apply_refund_succeeded(text,text,numeric,boolean) to service_role;

-- ---------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------
