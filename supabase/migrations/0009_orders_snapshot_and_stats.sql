-- =====================================================================
-- QuickTab Admin — orders customer snapshot + daily stats (M5)
-- ---------------------------------------------------------------------
-- Run AFTER 0008_tables_seats.sql.
--
-- customer_name_snapshot removes the RLS-blocked profiles embed from order
-- lists. The customer app will fill it at checkout; null renders as "Guest".
--
-- restaurant_daily_stats is SECURITY INVOKER on purpose: orders RLS already
-- limits callers to their own orders or their restaurant's orders.
--
-- Safe to re-run.
-- =====================================================================

alter table public.orders
  add column if not exists customer_name_snapshot text;

comment on column public.orders.customer_name_snapshot is
  'Display name captured at checkout; null for guests/anonymous orders.';

create or replace function public.restaurant_daily_stats(
  p_restaurant_id uuid,
  p_timezone text default 'UTC'
)
returns table (
  period text,
  orders_count bigint,
  revenue numeric,
  avg_order_value numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      (date_trunc('day', now() at time zone p_timezone)) at time zone p_timezone as today_start,
      (date_trunc('day', now() at time zone p_timezone)) at time zone p_timezone
        - interval '1 day' as yesterday_start
  ),
  aggregates as (
    select
      'today'::text as period,
      count(*)::bigint as orders_count,
      coalesce(sum(o.total), 0)::numeric as revenue
    from public.orders o, bounds b
    where o.restaurant_id = p_restaurant_id
      and o.status <> 'cancelled'
      and o.created_at >= b.today_start
      and o.created_at < b.today_start + interval '1 day'

    union all

    select
      'yesterday'::text as period,
      count(*)::bigint as orders_count,
      coalesce(sum(o.total), 0)::numeric as revenue
    from public.orders o, bounds b
    where o.restaurant_id = p_restaurant_id
      and o.status <> 'cancelled'
      and o.created_at >= b.yesterday_start
      and o.created_at < b.yesterday_start + interval '1 day'
  )
  select
    a.period,
    a.orders_count,
    a.revenue,
    case
      when a.orders_count = 0 then 0::numeric
      else round(a.revenue / a.orders_count, 2)
    end as avg_order_value
  from aggregates a
  order by a.period;
$$;

grant execute on function public.restaurant_daily_stats(uuid, text) to authenticated;
