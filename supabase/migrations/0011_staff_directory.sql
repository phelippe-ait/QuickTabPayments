-- =====================================================================
-- QuickTab Admin — staff directory, add-by-email, manager staff policy (M7)
-- ---------------------------------------------------------------------
-- Run AFTER 0010_refunds.sql.
--
-- profiles RLS stays self-only. The directory is exposed through one
-- SECURITY DEFINER RPC that checks active staff membership, so no table
-- policy is widened.
--
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Directory RPC
-- ---------------------------------------------------------------------
create or replace function public.list_staff_directory(p_restaurant_id uuid)
returns table (
  staff_id  uuid,
  user_id   uuid,
  email     text,
  first_name text,
  last_name text,
  role      public.staff_role,
  is_active boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rs.id,
    rs.user_id,
    p.email,
    p.first_name,
    p.last_name,
    rs.role,
    rs.is_active,
    rs.created_at
  from public.restaurant_staff rs
  join public.profiles p on p.id = rs.user_id
  where rs.restaurant_id = p_restaurant_id
    and public.is_staff_of(p_restaurant_id)
  order by rs.created_at asc;
$$;

revoke all on function public.list_staff_directory(uuid) from public;
revoke all on function public.list_staff_directory(uuid) from anon;
grant execute on function public.list_staff_directory(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Add an existing account by email
-- ---------------------------------------------------------------------
-- The role-escalation trigger in 0002 blocks profile role changes. Allow this
-- one controlled promotion through a transaction-local GUC.
create or replace function public.enforce_role_change_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_privileged boolean;
begin
  if new.role is distinct from old.role then
    caller_is_privileged :=
      auth.role() = 'service_role'
      or session_user in ('postgres', 'supabase_admin')
      or current_setting('quicktab.allow_staff_promotion', true) = 'on'
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      );

    if not caller_is_privileged then
      raise exception 'Only admins can change a profile role'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

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

  perform set_config('quicktab.allow_staff_promotion', 'on', true);
  update public.profiles
     set role = 'staff'
   where id = v_user_id
     and role = 'customer';
  perform set_config('quicktab.allow_staff_promotion', 'off', true);

  return v_staff_id;
end;
$$;

revoke all on function public.add_staff_by_email(uuid, text, public.staff_role) from public;
revoke all on function public.add_staff_by_email(uuid, text, public.staff_role) from anon;
grant execute on function public.add_staff_by_email(uuid, text, public.staff_role) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Manager staff policy (replaces owner-only management)
-- ---------------------------------------------------------------------
drop policy if exists "staff_owner_manage" on public.restaurant_staff;
drop policy if exists "staff_manager_manage" on public.restaurant_staff;

create policy "staff_manager_manage"
  on public.restaurant_staff for all
  using      ( public.is_manager_of(restaurant_id) )
  with check ( public.is_manager_of(restaurant_id) );

-- ---------------------------------------------------------------------
-- 4. Owner rows stay owner-only
-- ---------------------------------------------------------------------
create or replace function public.guard_staff_owner_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_privileged boolean;
begin
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and (old.role = 'owner' or new.role = 'owner')) then

    caller_is_privileged :=
      auth.role() = 'service_role'
      or session_user in ('postgres', 'supabase_admin')
      or public.is_owner_of(old.restaurant_id);

    if not caller_is_privileged then
      raise exception 'Only the restaurant owner can change or remove an owner row'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_staff_owner_rows on public.restaurant_staff;
create trigger guard_staff_owner_rows
  before update or delete on public.restaurant_staff
  for each row execute function public.guard_staff_owner_rows();

-- ---------------------------------------------------------------------
-- 5. Index for the directory (includes inactive rows)
-- ---------------------------------------------------------------------
create index if not exists idx_staff_restaurant_all
  on public.restaurant_staff(restaurant_id);
