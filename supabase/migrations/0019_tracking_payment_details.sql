-- =====================================================================
-- QuickTab — payment + refund details in guest tracking (0019)
-- ---------------------------------------------------------------------
-- The tracking page is token-authorised and public. Customers should be able
-- to see their receipt and whether an order was partially or fully refunded.
--
-- Adds to get_order_tracking()'s JSON:
--   payment_status, payment_method_type, receipt_url, amount_paid,
--   refunded_total
--
-- The function stays SECURITY DEFINER and token-scoped; no new table access is
-- granted to anon/authenticated.
--
-- Safe to re-run.
-- =====================================================================

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

comment on function public.get_order_tracking(text) is
  'Token-authorised, read-only order tracking. Includes payment status, receipt URL and refunded total. Returns null for unknown tokens.';

-- ---------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------
