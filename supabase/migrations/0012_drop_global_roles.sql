-- =====================================================================
-- QuickTab Admin — remove the unused global roles layer (0012)
-- ---------------------------------------------------------------------
-- Run AFTER 0011_staff_directory.sql.
--
-- Authorization is per restaurant (`restaurant_staff.role`, a staff_role
-- enum). The global `profiles.role` + `public.roles` lookup were never read
-- by the app and went stale; this migration removes that second role system.
--
-- Also drops the promotion block from add_staff_by_email, which was the only
-- remaining runtime writer of profiles.role.
--
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Recreate add_staff_by_email without the global-role promotion
-- ---------------------------------------------------------------------
create or replace function public.add_staff_by_email(
  p_restaurant_id uuid,
  p_email text,
  p_role public.staff_role default 'manager'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_staff_id uuid;
begin
  if not public.is_manager_of(p_restaurant_id) then
    raise exception 'Only an owner or manager can add team members'
      using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'Owner access cannot be granted from this screen'
      using errcode = '42501';
  end if;

  select p.id into v_user_id
  from public.profiles p
  where lower(p.email) = lower(btrim(p_email));

  if v_user_id is null then
    raise exception 'No account found for %. Ask them to sign up to QuickTab first.', btrim(p_email)
      using errcode = 'P0002';
  end if;

  insert into public.restaurant_staff (restaurant_id, user_id, role, is_active)
  values (p_restaurant_id, v_user_id, p_role, true)
  on conflict (restaurant_id, user_id) do update
    set role = excluded.role,
        is_active = true
  returning id into v_staff_id;

  return v_staff_id;
end;
$$;

revoke all on function public.add_staff_by_email(uuid, text, public.staff_role) from public;
revoke all on function public.add_staff_by_email(uuid, text, public.staff_role) from anon;
grant execute on function public.add_staff_by_email(uuid, text, public.staff_role) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Drop the escalation trigger/function that guarded profiles.role
-- ---------------------------------------------------------------------
drop trigger if exists enforce_role_change_permission on public.profiles;
drop function if exists public.enforce_role_change_permission();

-- ---------------------------------------------------------------------
-- 3. Drop the global role column and lookup table
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_fkey;
alter table public.profiles drop column if exists role;

drop table if exists public.roles;
