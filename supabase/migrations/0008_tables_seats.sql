-- =====================================================================
-- QuickTab Admin — table seat counts (D2)
-- ---------------------------------------------------------------------
-- Run AFTER 0007_onboarding_rpc.sql.
--
-- Seats are optional: Pick-up tables stay null. Uniqueness of
-- (restaurant_id, table_number) already exists in 0003.
--
-- Safe to re-run.
-- =====================================================================

alter table public.tables
  add column if not exists seats int;

alter table public.tables
  drop constraint if exists tables_seats_check;

alter table public.tables
  add constraint tables_seats_check
  check (seats is null or (seats between 1 and 12));

comment on column public.tables.seats is
  'Optional seat count for dine-in tables; null for Pick-up.';
