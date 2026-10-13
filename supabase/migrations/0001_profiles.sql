-- Profiles: one row per auth user, populated automatically on sign-up.
-- Run in the Supabase SQL Editor (or via `supabase db push` with the CLI).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user can only read and update their own profile. Inserts happen through the
-- SECURITY DEFINER trigger below, so no insert policy is required.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Copy name/email from the new auth user into a profile row.
-- Handles both email sign-up (first_name/last_name) and Google OAuth
-- (given_name/family_name).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'given_name'),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data ->> 'family_name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
