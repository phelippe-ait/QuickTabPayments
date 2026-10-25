-- =====================================================================
-- QuickTab Admin — Atomic restaurant onboarding (A6)
-- ---------------------------------------------------------------------
-- Run AFTER 0006_restaurants_manager_update.sql in the Supabase SQL editor.
--
-- Replaces the client's two-write onboarding (restaurant + owner membership)
-- with one security-definer function so a failed second insert cannot leave
-- an orphan restaurant behind.
--
-- The migration is safe to re-run.
-- =====================================================================

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

  return v_restaurant;
end;
$$;

revoke all on function public.create_restaurant_with_owner(text, text) from public;
revoke all on function public.create_restaurant_with_owner(text, text) from anon;
grant execute on function public.create_restaurant_with_owner(text, text) to authenticated;
