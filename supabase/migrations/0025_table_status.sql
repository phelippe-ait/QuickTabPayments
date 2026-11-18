-- =====================================================================
-- P06 — table operational status (C11, schema half)
-- ---------------------------------------------------------------------
-- Run AFTER 0024_place_order_modifiers.sql.
--
-- Adds an operational status for physical tables:
--   available -> occupied -> needs_cleaning -> available
--
-- RLS: no new policy is required. `tables_staff_manage` (0004) already
-- grants INSERT/UPDATE/DELETE on public.tables to active staff of the
-- table's restaurant (owner, manager and kitchen all pass is_staff_of),
-- while `tables_public_read` only grants SELECT of active rows to
-- anon/authenticated. Postgres has no column-level RLS, so the new
-- `status` column inherits those row policies: staff of restaurant A can
-- update A's table status, while customers, anon and staff of another
-- restaurant cannot update the row at all (UPDATE 0).
--
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. table_status enum
-- ---------------------------------------------------------------------
do $$
begin
  create type public.table_status as enum ('available', 'occupied', 'needs_cleaning');
exception
  when duplicate_object then null;
end $$;

comment on type public.table_status is
  'Operational state of a physical table: available, occupied or needs_cleaning.';

-- ---------------------------------------------------------------------
-- 2. tables.status
-- ---------------------------------------------------------------------
alter table public.tables
  add column if not exists status public.table_status not null default 'available';

comment on column public.tables.status is
  'Operational table state. Host seats guests -> occupied; guests leave -> needs_cleaning; table cleaned -> available. Updated by restaurant staff only; customers and anon cannot update tables.';

-- ---------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------
