-- =====================================================================
-- Add the staff role
-- ---------------------------------------------------------------------
-- New front-of-house role: full access to the staff workspace, but no admin
-- or team-management access. Kept in its own migration because PostgreSQL
-- enum values cannot be used reliably in the same transaction that adds them.
-- =====================================================================

alter type public.staff_role
  add value if not exists 'staff';
