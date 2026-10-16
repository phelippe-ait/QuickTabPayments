-- Roles: a fixed lookup table of the roles a profile can hold, plus the
-- profiles.role column that references it. Run AFTER 0001_profiles.sql, in the
-- Supabase SQL Editor (or via `supabase db push` with the CLI).
--
-- The migration is written to be safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Lookup table
-- ---------------------------------------------------------------------------
-- The role name is the natural primary key: it is short, stable, and the value
-- reads well both in SQL (`role = 'admin'`) and in client code
-- (`profile.role === 'admin'`), so callers never need a join or a numeric map.
create table if not exists public.roles (
  name text primary key,
  description text,
  created_at timestamptz not null default now()
);

alter table public.roles enable row level security;

-- Role names are not sensitive: any signed-in user may read the lookup table.
drop policy if exists "read roles" on public.roles;
create policy "read roles"
  on public.roles for select
  to authenticated
  using (true);

-- Seed the four roles. `on conflict do nothing` keeps this idempotent.
insert into public.roles (name, description) values
  ('customer', 'Places orders through the customer app'),
  ('staff',    'Handles orders on the staff dashboard'),
  ('manager',  'Oversees a restaurant''s menu, staff, and reporting'),
  ('admin',    'Full access, including managing users and their roles')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 2. profiles.role
-- ---------------------------------------------------------------------------
-- Added nullable first so existing rows can be backfilled before we enforce
-- NOT NULL.
alter table public.profiles add column if not exists role text;

-- Every current profile becomes a customer. (New sign-ups get the default
-- below, applied by the existing handle_new_user() trigger in 0001.)
update public.profiles set role = 'customer' where role is null;

alter table public.profiles alter column role set default 'customer';
alter table public.profiles alter column role set not null;

-- Foreign key to the lookup table. `on update cascade` keeps profiles valid if
-- a role is ever renamed. Dropped first so the migration can be re-run.
alter table public.profiles drop constraint if exists profiles_role_fkey;
alter table public.profiles
  add constraint profiles_role_fkey
  foreign key (role) references public.roles (name)
  on update cascade;

-- ---------------------------------------------------------------------------
-- 3. Guard against privilege escalation
-- ---------------------------------------------------------------------------
-- 0001 lets users update their own profile, which would also let them change
-- their own role. Only an existing admin (or a trusted service_role / direct
-- SQL session) may change a profile's role; everyone else keeps their current
-- role and can still edit the rest of their profile.
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
      -- Trusted backend (service_role key) or a direct SQL session (dashboard).
      auth.role() = 'service_role'
      or session_user in ('postgres', 'supabase_admin')
      -- Or an existing admin changing someone's role.
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

drop trigger if exists enforce_role_change_permission on public.profiles;
create trigger enforce_role_change_permission
  before update on public.profiles
  for each row execute function public.enforce_role_change_permission();
