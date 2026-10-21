-- =====================================================================
-- QuickTab Admin — Manager access to restaurant settings (D1)
-- ---------------------------------------------------------------------
-- Run AFTER 0005_storage.sql in the Supabase SQL editor.
--
-- Owners and managers may update the profile/branding fields of their
-- restaurant. Owner-only fields (owner_id, slug, is_active) remain
-- owner-only and are enforced by a trigger, not just by the UI.
--
-- The migration is safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. is_manager_of()
-- ---------------------------------------------------------------------
create or replace function public.is_manager_of(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_owner_of(p_restaurant_id)
    or exists (
      select 1
      from public.restaurant_staff rs
      where rs.restaurant_id = p_restaurant_id
        and rs.user_id       = auth.uid()
        and rs.is_active
        and rs.role in ('owner', 'manager')
    );
$$;

-- ---------------------------------------------------------------------
-- 2. restaurants update policy
-- ---------------------------------------------------------------------
drop policy if exists "restaurants_owner_update" on public.restaurants;
drop policy if exists "restaurants_staff_update" on public.restaurants;

create policy "restaurants_staff_update"
  on public.restaurants for update
  using      ( public.is_manager_of(id) )
  with check ( public.is_manager_of(id) );

-- ---------------------------------------------------------------------
-- 3. Guard owner-only columns
-- ---------------------------------------------------------------------
create or replace function public.guard_restaurants_owner_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_privileged boolean;
begin
  if new.owner_id  is distinct from old.owner_id
     or new.slug      is distinct from old.slug
     or new.is_active is distinct from old.is_active then

    caller_is_privileged :=
      -- Trusted backend (service_role key) or a direct SQL session (dashboard).
      auth.role() = 'service_role'
      or session_user in ('postgres', 'supabase_admin')
      or public.is_owner_of(old.id);

    if not caller_is_privileged then
      raise exception 'Only the restaurant owner can change slug, owner, or active status'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_restaurants_owner_fields on public.restaurants;
create trigger guard_restaurants_owner_fields
  before update on public.restaurants
  for each row execute function public.guard_restaurants_owner_fields();
