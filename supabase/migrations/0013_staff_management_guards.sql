-- =====================================================================
-- QuickTab Admin — staff management guardrails (0013)
-- ---------------------------------------------------------------------
-- Run AFTER 0012_drop_global_roles.sql.
--
-- Rules enforced here (and mirrored in the UI):
--   1. add_staff_by_email cannot target the caller's own account.
--   2. A manager cannot change another manager's role, active status, or
--      membership (peer managers are owner-managed).
--   3. The last active owner cannot be deactivated or demoted.
--   4. Nobody can change their own role/active status through the API; the
--      owner path is additionally capped by rule 3.
--
-- Trigger-owned rules run for PostgREST callers. Trusted direct SQL
-- (postgres/supabase_admin) and service_role still bypass them for
-- maintenance.
--
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. add_staff_by_email: reject self-targeting
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

  if v_user_id = auth.uid() then
    raise exception 'You cannot change your own membership from this screen'
      using errcode = '42501';
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
-- 2. Replace the owner-only guard with the full management guard
-- ---------------------------------------------------------------------
create or replace function public.guard_staff_management()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_privileged      boolean;
  v_active_owners   int;
begin
  v_privileged :=
    auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin');

  if v_privileged then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Owner rows may only be managed by the owner.
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and (old.role = 'owner' or new.role = 'owner')) then
    if not public.is_owner_of(old.restaurant_id) then
      raise exception 'Only the restaurant owner can change or remove an owner row'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    -- The last active owner must remain active and keep the owner role.
    if old.role = 'owner'
       and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
      select count(*)
        into v_active_owners
      from public.restaurant_staff
      where restaurant_id = old.restaurant_id
        and role = 'owner'
        and is_active;

      if v_active_owners <= 1 then
        raise exception 'The last active owner cannot be deactivated or demoted'
          using errcode = '42501';
      end if;
    end if;

    -- Nobody changes their own role or active status through the API.
    if old.user_id = auth.uid()
       and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
      raise exception 'You cannot change your own access'
        using errcode = '42501';
    end if;

    -- Managers cannot manage peer managers.
    if old.role = 'manager'
       and (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
       and not public.is_owner_of(old.restaurant_id) then
      raise exception 'Managers cannot manage other managers'
        using errcode = '42501';
    end if;

    return new;
  end if;

  -- DELETE: managers cannot remove peer managers.
  if old.role = 'manager' and not public.is_owner_of(old.restaurant_id) then
    raise exception 'Managers cannot manage other managers'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

drop trigger if exists guard_staff_owner_rows on public.restaurant_staff;
drop function if exists public.guard_staff_owner_rows();

drop trigger if exists guard_staff_management on public.restaurant_staff;
create trigger guard_staff_management
  before update or delete on public.restaurant_staff
  for each row execute function public.guard_staff_management();
