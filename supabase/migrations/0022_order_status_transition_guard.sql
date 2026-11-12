-- =====================================================================
-- QuickTab — Server-side order status transition guard (P03 / C4)
-- ---------------------------------------------------------------------
-- Run AFTER 0021_sales_reporting.sql.
--
-- Enforces the order status matrix in the database. The twin source of
-- truth is `transitions` in src/shared/orders/status.ts — keep both in
-- sync when editing either side.
--
-- Matrix:
--   pending    -> confirmed, cancelled
--   confirmed  -> preparing, cancelled
--   preparing  -> ready, cancelled
--   ready      -> completed, cancelled
--   completed  -> (terminal)
--   cancelled  -> (terminal)
--
-- Any UPDATE that changes `orders.status` outside this matrix raises
-- `invalid_status_transition` (errcode P0001), so a stale tab, a direct
-- API call, or a script cannot skip or rewind states. Same-status
-- updates are allowed as no-ops.
--
-- `completed_at` is "closed at": set for both `completed` and
-- `cancelled`. Nothing else in the schema maintains it, so this trigger
-- sets it alongside the status change (admin clients may also send
-- their own value; it is preserved). Transitions out of terminal states
-- are impossible under the matrix, so there is nothing to clear.
--
-- Existing payment RPCs are compatible:
--   * apply_payment_succeeded — pending -> confirmed (legal)
--   * apply_payment_failed    — pending -> cancelled (legal)
-- No RPC in 0016–0019 performs any other status transition.
--
-- Safe to re-run.
-- =====================================================================

create or replace function public.check_order_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  -- Allow updates that set status to its current value.
  if new.status = old.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'pending'   then new.status in ('confirmed', 'cancelled')
    when 'confirmed' then new.status in ('preparing', 'cancelled')
    when 'preparing' then new.status in ('ready', 'cancelled')
    when 'ready'     then new.status in ('completed', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  if new.status in ('completed', 'cancelled') then
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  return new;
end;
$$;

comment on function public.check_order_status_transition() is
  'BEFORE UPDATE OF status guard on public.orders. Mirrors the matrix in src/shared/orders/status.ts; raises invalid_status_transition (P0001) for illegal pairs and maintains completed_at on terminal states.';

drop trigger if exists trg_orders_status_transition on public.orders;
create trigger trg_orders_status_transition
  before update of status on public.orders
  for each row execute function public.check_order_status_transition();
