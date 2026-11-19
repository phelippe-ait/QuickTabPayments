-- =====================================================================
-- Refund guards count in-flight refunds and serialise per payment/line
-- ---------------------------------------------------------------------
-- The API inserts a refund row once Stripe has accepted the refund. While
-- Stripe settles it the row is 'requested', but the money is already
-- reserved and no longer refundable, so the amount and quantity guards must
-- count it.
--
-- Two gaps are closed here:
--   * guard_refund_amount summed only 'succeeded' refunds, so a second
--     refund could pass the cap while an earlier one was still requested.
--   * Neither guard locked the row it caps against, so two concurrent
--     refunds could both read the same total and both pass.
--
-- Locking the payment row serialises concurrent refunds for that payment;
-- locking the order-item row does the same for concurrent line refunds.
-- The triggers fire in name order, so both transactions take the payment
-- lock first (guard_refund_amount) and the line lock second
-- (guard_refund_quantity), which keeps the lock order consistent.
--
-- Safe to re-run.
-- =====================================================================

create or replace function public.guard_refund_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment  public.payments;
  v_refunded numeric;
begin
  -- Lock the payment so concurrent refunds for it serialise on the cap.
  select * into v_payment
  from public.payments
  where id = new.payment_id
  for update;

  if not found then
    raise exception 'Payment not found for this refund'
      using errcode = '23503';
  end if;

  if v_payment.order_id <> new.order_id then
    raise exception 'Refund order does not match the payment order'
      using errcode = '23514';
  end if;

  if v_payment.status <> 'succeeded' then
    raise exception 'Only succeeded payments can be refunded'
      using errcode = '23514';
  end if;

  select coalesce(sum(amount), 0)
    into v_refunded
  from public.refunds
  where payment_id = new.payment_id
    and status in ('succeeded', 'requested')
    and id is distinct from new.id;

  if v_refunded + new.amount > v_payment.amount then
    raise exception 'Refund amount exceeds the remaining payment balance'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.guard_refund_quantity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item     public.order_items;
  v_used     int;
  v_expected numeric;
begin
  if new.order_item_id is null then
    return new;
  end if;

  -- Lock the line so concurrent refunds for it serialise on the cap.
  select * into v_item
  from public.order_items
  where id = new.order_item_id
  for update;

  if not found then
    raise exception 'Order line not found for this refund'
      using errcode = '23503';
  end if;

  if v_item.order_id <> new.order_id then
    raise exception 'Refund order does not match the order line'
      using errcode = '23514';
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'Line refunds require a positive quantity'
      using errcode = '23514';
  end if;

  if new.quantity > v_item.quantity then
    raise exception 'Refund quantity exceeds the ordered quantity'
      using errcode = '23514';
  end if;

  select coalesce(sum(quantity), 0)
    into v_used
  from public.refunds
  where order_item_id = new.order_item_id
    and status in ('succeeded', 'requested')
    and id is distinct from new.id;

  if v_used + new.quantity > v_item.quantity then
    raise exception 'Refund quantity exceeds the remaining line quantity'
      using errcode = '23514';
  end if;

  v_expected := round(v_item.unit_price_snapshot * new.quantity, 2);
  if new.amount <> v_expected then
    raise exception 'Line refund amount must equal unit price × quantity'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.guard_refund_amount() is
  'Caps refunds at the payment balance, counts in-flight (requested) refunds, and locks the payment row so concurrent refunds serialise.';
comment on function public.guard_refund_quantity() is
  'Caps line refunds at the ordered quantity, counts in-flight (requested) refunds, and locks the order-item row so concurrent refunds serialise.';
