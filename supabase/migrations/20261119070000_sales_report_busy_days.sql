-- =====================================================================
-- Sales report: busy days
-- ---------------------------------------------------------------------
-- Adds `busy_days` to `get_sales_report`, mirroring `busy_hours` but grouped
-- by day-of-week in the restaurant timezone. The array is zero-filled for all
-- seven days (0 = Sunday … 6 = Saturday) so the chart never shifts.
--
-- No tables, policies or grants change; access stays owner/manager only.
--
-- Safe to re-run.
-- =====================================================================

create or replace function public.get_sales_report(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_currency      text;
  v_timezone      text;
  v_from          timestamptz;
  v_to            timestamptz;
  v_order_count   int;
  v_gross_revenue numeric;
  v_paid_revenue  numeric;
  v_refunded      numeric;
  v_aov           numeric;
  v_top_items     jsonb;
  v_popular_items jsonb;
  v_busy_hours    jsonb;
  v_busy_days     jsonb;
begin
  -- -----------------------------------------------------------------
  -- Caller verification: active owner/manager of exactly one restaurant
  -- (single-restaurant site). Everyone else gets `not_authorised`.
  -- -----------------------------------------------------------------
  select r.id, r.currency, r.timezone
    into v_restaurant_id, v_currency, v_timezone
  from public.restaurant_staff rs
  join public.restaurants r on r.id = rs.restaurant_id
  where rs.user_id = auth.uid()
    and rs.is_active
    and rs.role in ('owner', 'manager')
  order by r.created_at, r.id
  limit 1;

  if v_restaurant_id is null then
    raise exception 'not_authorised' using errcode = 'P0001';
  end if;

  -- -----------------------------------------------------------------
  -- Date range: defaults, validation, and a hard 366-day cap.
  -- -----------------------------------------------------------------
  v_to   := coalesce(p_to, now());
  v_from := coalesce(p_from, v_to - interval '30 days');

  if v_from >= v_to then
    raise exception 'invalid_date_range' using errcode = 'P0001';
  end if;

  if v_to - v_from > interval '366 days' then
    v_from := v_to - interval '366 days';
  end if;

  -- -----------------------------------------------------------------
  -- Order count + gross revenue (created in range, not cancelled)
  -- -----------------------------------------------------------------
  select count(*), coalesce(sum(o.total), 0)
    into v_order_count, v_gross_revenue
  from public.orders o
  where o.restaurant_id = v_restaurant_id
    and o.created_at >= v_from
    and o.created_at <  v_to
    and o.status <> 'cancelled';

  v_gross_revenue := round(v_gross_revenue, 2);

  -- Average order value (0 when there are no orders).
  if v_order_count = 0 then
    v_aov := 0;
  else
    v_aov := round(v_gross_revenue / v_order_count, 2);
  end if;

  -- -----------------------------------------------------------------
  -- Paid revenue: succeeded payments whose paid_at falls in range.
  -- -----------------------------------------------------------------
  select coalesce(sum(p.amount), 0)
    into v_paid_revenue
  from public.payments p
  join public.orders o on o.id = p.order_id
  where o.restaurant_id = v_restaurant_id
    and p.status = 'succeeded'
    and p.paid_at >= v_from
    and p.paid_at <  v_to;

  v_paid_revenue := round(v_paid_revenue, 2);

  -- -----------------------------------------------------------------
  -- Refunded amount: succeeded refunds created in range.
  -- -----------------------------------------------------------------
  select coalesce(sum(rf.amount), 0)
    into v_refunded
  from public.refunds rf
  join public.orders o on o.id = rf.order_id
  where o.restaurant_id = v_restaurant_id
    and rf.status = 'succeeded'
    and rf.created_at >= v_from
    and rf.created_at <  v_to;

  v_refunded := round(v_refunded, 2);

  -- -----------------------------------------------------------------
  -- Top 10 items by revenue (snapshot name), not cancelled, in range.
  -- -----------------------------------------------------------------
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name',     t.item_name_snapshot,
        'quantity', t.quantity,
        'revenue',  round(t.revenue, 2)::text
      )
      order by t.revenue desc, t.item_name_snapshot
    ),
    '[]'::jsonb
  )
  into v_top_items
  from (
    select
      oi.item_name_snapshot,
      sum(oi.quantity)::int as quantity,
      sum(oi.subtotal)      as revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.restaurant_id = v_restaurant_id
      and o.created_at >= v_from
      and o.created_at <  v_to
      and o.status <> 'cancelled'
    group by oi.item_name_snapshot
    order by revenue desc, oi.item_name_snapshot
    limit 10
  ) t;

  -- -----------------------------------------------------------------
  -- Popular items: top 10 by quantity sold for kitchen prep. Revenue
  -- breaks quantity ties so the order is deterministic.
  -- -----------------------------------------------------------------
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name',     t.item_name_snapshot,
        'quantity', t.quantity,
        'revenue',  round(t.revenue, 2)::text
      )
      order by t.quantity desc, t.revenue desc, t.item_name_snapshot
    ),
    '[]'::jsonb
  )
  into v_popular_items
  from (
    select
      oi.item_name_snapshot,
      sum(oi.quantity)::int as quantity,
      sum(oi.subtotal)      as revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.restaurant_id = v_restaurant_id
      and o.created_at >= v_from
      and o.created_at <  v_to
      and o.status <> 'cancelled'
    group by oi.item_name_snapshot
    order by quantity desc, revenue desc, oi.item_name_snapshot
    limit 10
  ) t;

  -- -----------------------------------------------------------------
  -- Busy hours: orders per hour-of-day in the restaurant timezone,
  -- zero-filled for all 24 hours so the chart never shifts.
  -- -----------------------------------------------------------------
  select jsonb_agg(
    jsonb_build_object(
      'hour',   gs.hr,
      'orders', coalesce(h.orders, 0)
    )
    order by gs.hr
  )
  into v_busy_hours
  from generate_series(0, 23) as gs(hr)
  left join (
    select
      extract(hour from (o.created_at at time zone v_timezone))::int as hr,
      count(*)::int as orders
    from public.orders o
    where o.restaurant_id = v_restaurant_id
      and o.created_at >= v_from
      and o.created_at <  v_to
      and o.status <> 'cancelled'
    group by 1
  ) h on h.hr = gs.hr;

  -- -----------------------------------------------------------------
  -- Busy days: orders per day-of-week in the restaurant timezone,
  -- zero-filled for Sunday..Saturday so the chart never shifts.
  -- -----------------------------------------------------------------
  select jsonb_agg(
    jsonb_build_object(
      'day',    gs.dow,
      'orders', coalesce(d.orders, 0)
    )
    order by gs.dow
  )
  into v_busy_days
  from generate_series(0, 6) as gs(dow)
  left join (
    select
      extract(dow from (o.created_at at time zone v_timezone))::int as dow,
      count(*)::int as orders
    from public.orders o
    where o.restaurant_id = v_restaurant_id
      and o.created_at >= v_from
      and o.created_at <  v_to
      and o.status <> 'cancelled'
    group by 1
  ) d on d.dow = gs.dow;

  return jsonb_build_object(
    'currency',        v_currency,
    'from',            v_from,
    'to',              v_to,
    'order_count',     v_order_count,
    'gross_revenue',   v_gross_revenue::text,
    'paid_revenue',    v_paid_revenue::text,
    'refunded_amount', v_refunded::text,
    'aov',             v_aov::text,
    'top_items',       v_top_items,
    'popular_items',   v_popular_items,
    'busy_hours',      v_busy_hours,
    'busy_days',       v_busy_days
  );
end;
$$;

-- Owners/managers only. On Supabase the default privileges grant EXECUTE
-- directly to anon/authenticated, so revoke from those roles explicitly
-- (same lesson as 0018) as well as PUBLIC.
revoke all on function public.get_sales_report(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_sales_report(timestamptz, timestamptz)
  to authenticated;

comment on function public.get_sales_report(timestamptz, timestamptz) is
  'Admin sales report for the caller''s restaurant. Owner/manager only; aggregates orders, payments, refunds, top items (revenue-led), popular items (quantity-led), busy hours and busy days server-side.';

-- ---------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------
