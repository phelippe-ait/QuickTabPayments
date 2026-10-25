-- =====================================================================
-- Developer helper — create a restaurant invitation
-- ---------------------------------------------------------------------
-- Run in the Supabase SQL editor (postgres) or via the CLI:
--
--   npx supabase db query --linked --file supabase/scripts/create_restaurant_invite.sql
--
-- Edit the parameters CTE below, then run. The owner must sign in with this
-- exact, email-confirmed address to see the claim screen at /admin.
--
-- Idempotent: it will not create a second pending invite for the same email.
-- =====================================================================

with params as (
  select
    'owner@example.com'::citext as email,
    'Harbour Café'::text         as restaurant_name,
    'harbour-cafe'::text         as restaurant_slug,
    'dev@quicktab'::text         as invited_by,
    interval '30 days'           as expires_in
)
insert into public.restaurant_invites (
  email,
  restaurant_name,
  restaurant_slug,
  invited_by,
  expires_at
)
select
  p.email,
  p.restaurant_name,
  p.restaurant_slug,
  p.invited_by,
  now() + p.expires_in
from params p
where not exists (
  select 1
  from public.restaurant_invites i
  where lower(i.email) = lower(p.email)
    and i.status = 'pending'
)
returning id, email, restaurant_name, restaurant_slug, status, expires_at;

-- If the insert returned no row, a pending invitation already exists for that
-- email. Inspect it here (replace the email):
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
-- Then rerun the insert above with the corrected details.
