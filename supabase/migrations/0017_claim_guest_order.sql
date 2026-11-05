-- =====================================================================
-- QuickTab — claim a guest order after signing in (0017)
-- ---------------------------------------------------------------------
-- A guest order has customer_id = null. If the guest later signs in from the
-- confirmation screen, the opaque tracking token proves they own the order;
-- this RPC attaches it to their account so it appears in order history.
--
-- Only orders that are still unclaimed are updated, so one customer can never
-- steal another customer's order. Cancelled orders are left alone.
--
-- Safe to re-run.
-- =====================================================================

create or replace function public.claim_guest_order(p_tracking_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated int := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_tracking_token is null or length(btrim(p_tracking_token)) = 0 then
    return false;
  end if;

  update public.orders
     set customer_id = v_user_id
   where tracking_token = btrim(p_tracking_token)
     and customer_id is null
     and status <> 'cancelled';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.claim_guest_order(text) from public;
grant execute on function public.claim_guest_order(text) to authenticated;

comment on function public.claim_guest_order(text) is
  'Attaches an unclaimed guest order to the signed-in customer, authorised by the opaque tracking token.';

-- ---------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------
