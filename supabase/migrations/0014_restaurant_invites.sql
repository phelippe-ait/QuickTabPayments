-- =====================================================================
-- QuickTab — developer-issued restaurant invitations (0014)
-- ---------------------------------------------------------------------
-- Run AFTER 0013_staff_management_guards.sql.
--
-- Onboarding is no longer self-serve. A developer/back office creates a
-- pending invitation for the owner's verified email; the owner signs in,
-- reviews the prefilled restaurant details, and claims it atomically.
--
-- The old create_restaurant_with_owner RPC remains in the schema for
-- compatibility but its client execute grant is revoked.
--
-- Safe to re-run.
-- =====================================================================

create table if not exists public.restaurant_invites (
  id                     uuid primary key default gen_random_uuid(),
  email                  citext not null,
  restaurant_name        text not null,
  restaurant_slug        text not null,
  status                 text not null default 'pending'
                         check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by             text,
  created_at             timestamptz not null default now(),
  expires_at             timestamptz not null default (now() + interval '30 days'),
  accepted_at            timestamptz,
  accepted_restaurant_id uuid references public.restaurants(id) on delete set null
);

create index if not exists idx_restaurant_invites_email
  on public.restaurant_invites (lower(email));

-- Only one live invitation per email address.
create unique index if not exists uq_restaurant_invites_pending_email
  on public.restaurant_invites (lower(email))
  where status = 'pending';

alter table public.restaurant_invites enable row level security;

-- No client policies: reads go through get_my_restaurant_invite(), writes are
-- developer/service-role only.

comment on table public.restaurant_invites is
  'Developer-issued onboarding invitations. Owners claim these after signing in with the invited verified email.';

-- ---------------------------------------------------------------------
-- 1. Read the signed-in user's pending invitation
-- ---------------------------------------------------------------------
create or replace function public.get_my_restaurant_invite()
returns table (
  id uuid,
  email text,
  restaurant_name text,
  restaurant_slug text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.email::text,
    i.restaurant_name,
    i.restaurant_slug,
    i.expires_at
  from public.restaurant_invites i
  join auth.users u on lower(u.email) = lower(i.email)
  where u.id = auth.uid()
    and u.email_confirmed_at is not null
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_restaurant_invite() from public;
revoke all on function public.get_my_restaurant_invite() from anon;
grant execute on function public.get_my_restaurant_invite() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Claim the invitation atomically
-- ---------------------------------------------------------------------
create or replace function public.claim_restaurant_invite(
  p_name text default null,
  p_slug text default null
)
returns public.restaurants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_email      text;
  v_invite     public.restaurant_invites;
  v_name       text;
  v_slug       text;
  v_restaurant public.restaurants;
begin
  if v_user is null then
    raise exception 'Sign in before claiming a restaurant invitation'
      using errcode = '42501';
  end if;

  select u.email
    into v_email
  from auth.users u
  where u.id = v_user
    and u.email_confirmed_at is not null;

  if v_email is null then
    raise exception 'Verify your email address before claiming a restaurant invitation'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.restaurant_staff
    where user_id = v_user and is_active
  ) then
    raise exception 'This account already has an active restaurant'
      using errcode = '23505';
  end if;

  select i.*
    into v_invite
  from public.restaurant_invites i
  where i.status = 'pending'
    and lower(i.email) = lower(v_email)
    and i.expires_at > now()
  order by i.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No pending restaurant invitation found for this email'
      using errcode = 'P0002';
  end if;

  v_name := btrim(coalesce(nullif(p_name, ''), v_invite.restaurant_name));
  v_slug := lower(btrim(coalesce(nullif(p_slug, ''), v_invite.restaurant_slug)));

  if v_name = '' then
    raise exception 'Restaurant name is required'
      using errcode = '22023';
  end if;

  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 60 then
    raise exception 'Web address must use lowercase letters, numbers and single hyphens (max 60 characters)'
      using errcode = '22023';
  end if;

  begin
    insert into public.restaurants (owner_id, slug, name)
    values (v_user, v_slug, v_name)
    returning * into v_restaurant;
  exception
    when unique_violation then
      raise exception 'That web address is already taken. Choose another one.'
        using errcode = '23505';
  end;

  insert into public.restaurant_staff (restaurant_id, user_id, role, is_active)
  values (v_restaurant.id, v_user, 'owner', true)
  on conflict (restaurant_id, user_id) do update
    set role = 'owner', is_active = true;

  update public.restaurant_invites
     set status = 'accepted',
         accepted_at = now(),
         accepted_restaurant_id = v_restaurant.id
   where id = v_invite.id;

  return v_restaurant;
end;
$$;

revoke all on function public.claim_restaurant_invite(text, text) from public;
revoke all on function public.claim_restaurant_invite(text, text) from anon;
grant execute on function public.claim_restaurant_invite(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Close the old self-serve onboarding door
-- ---------------------------------------------------------------------
revoke all on function public.create_restaurant_with_owner(text, text) from public;
revoke all on function public.create_restaurant_with_owner(text, text) from anon;
revoke all on function public.create_restaurant_with_owner(text, text) from authenticated;
