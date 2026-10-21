-- =====================================================================
-- Developer helper — create a restaurant invitation
-- ---------------------------------------------------------------------
-- Run in the Supabase SQL editor (postgres) or via the CLI:
--
--   npx supabase db query --linked --file supabase/scripts/create_restaurant_invite.sql
--
-- Replace the four values below, then run. The owner must sign in with this
-- exact, email-confirmed address to see the claim screen at /admin.
--
-- Idempotent: it will not create a second pending invite for the same email.
-- =====================================================================

insert into public.restaurant_invites (
  email,
  restaurant_name,
  restaurant_slug,
  invited_by,
  expires_at
)
select
  'owner@example.com',
  'Harbour Café',
  'harbour-cafe',
  'dev@quicktab',
  now() + interval '30 days'
where not exists (
  select 1
  from public.restaurant_invites
  where lower(email) = lower('owner@example.com')
    and status = 'pending'
);

select id, email, restaurant_name, restaurant_slug, status, expires_at
from public.restaurant_invites
where lower(email) = lower('owner@example.com')
order by created_at desc;

-- ---------------------------------------------------------------------
-- Revoke / replace an invitation
-- ---------------------------------------------------------------------
-- update public.restaurant_invites
--    set status = 'revoked'
--  where lower(email) = lower('owner@example.com')
--    and status = 'pending';
