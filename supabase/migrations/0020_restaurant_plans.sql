-- =====================================================================
-- QuickTab — Subscription tiers schema (P01 / B1.1, B1.2, B1.6)
-- ---------------------------------------------------------------------
-- Run AFTER 0019_tracking_payment_details.sql.
--
-- Adds:
--   1. public.restaurant_plan enum — basic | standard | premium.
--   2. restaurants.plan column, defaulting to 'basic'.
--   3. idx_restaurants_plan lookup index.
--
-- Design notes:
--   * This is schema only. No billing, Stripe subscription, feature
--     matrix, or plan-aware UI is implemented here.
--   * The tier prices in the column comment are informational.
--   * RLS: column-level RLS does not exist in Postgres, so no new policy
--     is required. `restaurants_public_read_active` already lets anon and
--     authenticated read the whole row (and therefore `plan`), while
--     `restaurants_staff_update` still restricts updates to managers of
--     that same restaurant.
--
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. restaurant_plan enum
-- ---------------------------------------------------------------------
do $$
begin
  create type public.restaurant_plan as enum ('basic', 'standard', 'premium');
exception
  when duplicate_object then null;
end $$;

comment on type public.restaurant_plan is
  'Subscription tier for a restaurant. Informational only; no billing is implemented.';

-- ---------------------------------------------------------------------
-- 2. restaurants.plan
-- ---------------------------------------------------------------------
alter table public.restaurants
  add column if not exists plan public.restaurant_plan not null default 'basic';

-- Backfill is automatic via the default; the explicit update keeps re-runs
-- and any pre-existing nullable column on a consistent value.
update public.restaurants
   set plan = 'basic'
 where plan is null;

create index if not exists idx_restaurants_plan
  on public.restaurants(plan);

comment on column public.restaurants.plan is
  'Subscription tier: basic (AUD $29/mo), standard ($59), premium ($99). Informational only — no billing is implemented.';

-- ---------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------
