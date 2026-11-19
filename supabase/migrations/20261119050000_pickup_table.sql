-- =====================================================================
-- System counter / pick-up table
-- ---------------------------------------------------------------------
-- Every restaurant gets one permanent service table for counter and pick-up
-- orders. It is created with the restaurant, appears first on the floor plan,
-- and can only be enabled/disabled or moved through its operational status.
-- It cannot be edited structurally or deleted.
--
-- Existing restaurants: an existing Pick-up/Counter table is promoted, or a
-- new one is inserted. New restaurants created through the onboarding RPCs get
-- one automatically.
--
-- Safe to re-run.
-- =====================================================================

alter table public.tables
  add column if not exists is_system boolean not null default false;

comment on column public.tables.is_system is
  'True for the permanent counter/pick-up table. System tables cannot be edited structurally or deleted.';

-- ---------------------------------------------------------------------
-- 1. Idempotent creation/promotion helper
-- ---------------------------------------------------------------------
create or replace function public.ensure_pickup_table(p_restaurant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id uuid;
begin
  select t.id
    into v_table_id
  from public.tables t
  where t.restaurant_id = p_restaurant_id
    and t.is_system
  limit 1;

  if v_table_id is not null then
    return v_table_id;
  end if;

  select t.id
    into v_table_id
  from public.tables t
  where t.restaurant_id = p_restaurant_id
    and (
      lower(t.table_number) in ('pick-up', 'pickup', 'counter', 'counter / pick-up')
      or lower(coalesce(t.location_label, '')) in ('pick-up', 'pickup', 'counter')
    )
  order by t.created_at, t.id
  limit 1;

  if v_table_id is not null then
    update public.tables
       set is_system = true,
           location_label = 'Counter'
     where id = v_table_id;
    return v_table_id;
  end if;

  insert into public.tables (
    restaurant_id,
    table_number,
    location_label,
    is_active,
    is_system
  )
  values (
    p_restaurant_id,
    'Pick-up',
    'Counter',
    true,
    true
  )
  returning id into v_table_id;

  return v_table_id;
end;
$$;

revoke all on function public.ensure_pickup_table(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Backfill every existing restaurant
-- ---------------------------------------------------------------------
do $$
declare
  v_restaurant record;
begin
  for v_restaurant in select id from public.restaurants loop
    perform public.ensure_pickup_table(v_restaurant.id);
  end loop;
end;
$$;

create unique index if not exists uq_tables_one_system_per_restaurant
  on public.tables(restaurant_id)
  where is_system;

-- ---------------------------------------------------------------------
-- 3. Protect the system table
-- ---------------------------------------------------------------------
create or replace function public.guard_system_table()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'system_table_immutable' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.is_system and not public.is_privileged_caller() then
      raise exception 'system_table_immutable' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.is_system is distinct from old.is_system
     and not public.is_privileged_caller() then
    raise exception 'system_table_immutable' using errcode = '42501';
  end if;

  if old.is_system and (
    new.restaurant_id  is distinct from old.restaurant_id
    or new.table_number  is distinct from old.table_number
    or new.qr_token      is distinct from old.qr_token
    or new.location_label is distinct from old.location_label
    or new.seats         is distinct from old.seats
    or new.created_at    is distinct from old.created_at
  ) then
    raise exception 'system_table_immutable' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_system_table on public.tables;
create trigger guard_system_table
  before insert or update or delete on public.tables
  for each row execute function public.guard_system_table();

comment on function public.guard_system_table() is
  'System counter/pick-up tables may only change is_active/status; deletion and structural edits are rejected.';

-- ---------------------------------------------------------------------
-- 4. Onboarding RPCs create the system table
-- ---------------------------------------------------------------------
create or replace function public.create_restaurant_with_owner(
  p_name text,
  p_slug text
)
returns public.restaurants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_name       text := btrim(coalesce(p_name, ''));
  v_slug       text := btrim(coalesce(p_slug, ''));
  v_restaurant public.restaurants;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to create a restaurant'
      using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'Restaurant name is required'
      using errcode = '22023';
  end if;

  if v_slug = '' then
    raise exception 'Restaurant web address is required'
      using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_user_id) then
    raise exception 'Your profile is not ready yet. Please try again.'
      using errcode = 'P0002';
  end if;

  begin
    insert into public.restaurants (owner_id, slug, name)
    values (v_user_id, v_slug, v_name)
    returning * into v_restaurant;
  exception when unique_violation then
    raise exception 'That web address is already taken. Choose another one.'
      using errcode = '23505';
  end;

  insert into public.restaurant_staff (restaurant_id, user_id, role, is_active)
  values (v_restaurant.id, v_user_id, 'owner', true)
  on conflict (restaurant_id, user_id) do update
    set role = 'owner', is_active = true;

  perform public.ensure_pickup_table(v_restaurant.id);

  return v_restaurant;
end;
$$;

revoke all on function public.create_restaurant_with_owner(text, text)
  from public, anon, authenticated;

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

  perform public.ensure_pickup_table(v_restaurant.id);

  update public.restaurant_invites
     set status = 'accepted',
         accepted_at = now(),
         accepted_restaurant_id = v_restaurant.id
   where id = v_invite.id;

  return v_restaurant;
end;
$$;

revoke all on function public.claim_restaurant_invite(text, text)
  from public, anon;
grant execute on function public.claim_restaurant_invite(text, text)
  to authenticated;

comment on function public.ensure_pickup_table(uuid) is
  'Returns the permanent counter/pick-up table for a restaurant, promoting an existing Pick-up/Counter row or creating one.';
