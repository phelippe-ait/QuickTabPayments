-- =====================================================================
-- QuickTab — Phase 6 payment-RPC lockdown (0018)
-- ---------------------------------------------------------------------
-- Run AFTER 0016_phase6_payments.sql (and 0017_claim_guest_order.sql).
--
-- WHY THIS MIGRATION EXISTS
--   0016 revoked EXECUTE from PUBLIC on the four payment RPCs and granted
--   it to service_role only. On Supabase that is NOT sufficient: the
--   project's default privileges grant EXECUTE on every new function in
--   `public` directly to `anon`, `authenticated`, and `service_role`, and
--   `REVOKE ... FROM PUBLIC` does not remove those direct grants.
--
--   Verified live before this fix (anon key, no JWT):
--     POST /rest/v1/rpc/apply_payment_succeeded  -> 204 (executed)
--     POST /rest/v1/rpc/apply_payment_failed     -> 204 (executed)
--     POST /rest/v1/rpc/apply_refund_succeeded   -> 204 (executed)
--     POST /rest/v1/rpc/record_payment_intent    -> executed; failed only
--       on the probe's FK (23503), proving EXECUTE was granted.
--
--   Impact: an anonymous caller who knows a pending order's
--   `pi_...` PaymentIntent id (visible in the client secret during
--   checkout) could mark the order paid WITHOUT paying
--   (apply_payment_succeeded flips payment -> succeeded and order
--   pending -> confirmed).
--
-- FIX
--   Explicitly revoke from `anon` and `authenticated` in addition to
--   PUBLIC, then re-assert the intended service_role-only grant.
--   The /api serverless functions call these RPCs with the service-role
--   key (api/_lib/supabaseAdmin.ts adminClient), so nothing in the app
--   breaks.
--
-- VERIFY AFTER APPLYING (has_function_privilege must be f / f / t):
--   see supabase/tests/rls_checks.sql -> "Phase 6 — payments".
--   An anon REST call to /rest/v1/rpc/apply_payment_succeeded must now
--   fail with 42501 "permission denied for function".
--
-- Safe to re-run.
-- =====================================================================

revoke all on function public.record_payment_intent(uuid,numeric,text,text,text)
  from public, anon, authenticated;
revoke all on function public.apply_payment_succeeded(text,text,text)
  from public, anon, authenticated;
revoke all on function public.apply_payment_failed(text,text)
  from public, anon, authenticated;
revoke all on function public.apply_refund_succeeded(text,text,numeric,boolean)
  from public, anon, authenticated;

-- Re-assert the intended grants (idempotent).
grant execute on function public.record_payment_intent(uuid,numeric,text,text,text)
  to service_role;
grant execute on function public.apply_payment_succeeded(text,text,text)
  to service_role;
grant execute on function public.apply_payment_failed(text,text)
  to service_role;
grant execute on function public.apply_refund_succeeded(text,text,numeric,boolean)
  to service_role;

comment on function public.apply_payment_succeeded(text,text,text) is
  'Service-role only (webhook). Idempotently marks the payment succeeded and confirms a pending order.';
comment on function public.apply_payment_failed(text,text) is
  'Service-role only (webhook). Idempotently marks the payment failed and cancels a pending order.';
comment on function public.record_payment_intent(uuid,numeric,text,text,text) is
  'Service-role only (create-payment-intent). Inserts the pending payments row for a Stripe intent.';
comment on function public.apply_refund_succeeded(text,text,numeric,boolean) is
  'Service-role only (webhook). Reconciles refund rows and fully-refunded payments.';

-- ---------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------
