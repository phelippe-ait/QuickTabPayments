-- =====================================================================
-- QuickTab — security audit: RLS + auth-flow fixes (P30 / E4-E5)
-- ---------------------------------------------------------------------
-- Run AFTER 0027_place_order_pending_status.sql (and the timestamped
-- 20261105* migrations).
--
-- This migration closes the gaps found in the table-by-table audit. Every
-- fix keeps the existing journeys working: guest ordering (place_order),
-- staff status updates, manager catalog/settings edits, invitations, and
-- service-role payments/refunds.
--
-- Summary of fixes
--   profiles              email/created_at are auth-owned; users may not
--                         rewrite their profile email (it is the key used by
--                         add_staff_by_email).
--   restaurants           self-serve INSERT closed (onboarding is
--                         invitation-only); `plan` is owner-only, like slug.
--   restaurant_staff      owner rows cannot be INSERTed by managers (the
--                         existing guard only covered UPDATE/DELETE).
--   orders                no direct client INSERT (place_order is the only
--                         writer); money/identity columns are immutable for
--                         API callers (customers, kitchen, managers).
--   order_items           no direct client INSERT (definer RPC only).
--   order_item_modifiers  no direct client INSERT (definer RPC only).
--   qr_sessions           no public read/write; RPC-only (unused by the app).
--   refunds               no client writes; rows are written by
--                         api/refunds.ts with the service role.
--   menu_* / modifiers    writes are owner/manager only (catalog routes);
--                         staff keep read access, the public keeps the
--                         existing public-read policies.
--   tables                kitchen may change only the operational `status`;
--                         structural fields stay owner/manager.
--   restaurant_locations  settings (coords + geofence) are owner/manager
--                         only; staff keep read access.
--   storage.objects       branding/menu uploads are owner/manager only.
--   function grants       anon cannot execute claim_guest_order or
--                         restaurant_daily_stats (Supabase default grants
--                         EXECUTE directly to anon/authenticated).
--
-- Trigger guard convention: the new guard functions are SECURITY INVOKER so
-- `current_user` reflects the API caller (authenticated/anon/service_role).
-- That lets rls_checks.sql verify them with `set local role`, unlike the
-- older `session_user` guards. is_owner_of()/is_manager_of() remain SECURITY
-- DEFINER and safe to call from an invoker trigger.
--
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Shared helper: is the caller a trusted backend / direct SQL session?
-- ---------------------------------------------------------------------
create or replace function public.is_privileged_caller()
returns boolean
language sql
stable
as $$
  select
    auth.role() = 'service_role'
    or current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin');
$$;

comment on function public.is_privileged_caller() is
  'True for service_role and direct SQL sessions. Used by audit guard triggers (SECURITY INVOKER) so current_user mirrors the API caller.';

-- Called from SECURITY INVOKER guard triggers, so every role that can write a
-- guarded table needs EXECUTE on it.
grant execute on function public.is_privileged_caller() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. profiles — auth owns email + row identity
-- ---------------------------------------------------------------------
-- profiles is self-only for SELECT/UPDATE (0001). UPDATE was column-wide, so a
-- user could rewrite their profile email and then be added to a team by a
-- manager who searched for the victim's address. Email changes belong to auth.
create or replace function public.guard_profile_identity_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.email is distinct from old.email
     or new.created_at is distinct from old.created_at then
    if not public.is_privileged_caller() then
      raise exception 'profile_identity_is_read_only' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_identity_fields on public.profiles;
create trigger guard_profile_identity_fields
  before update on public.profiles
  for each row execute function public.guard_profile_identity_fields();

comment on function public.guard_profile_identity_fields() is
  'BEFORE UPDATE guard: only trusted backends may change profiles.email/created_at. Prevents identity spoofing in add_staff_by_email.';

-- ---------------------------------------------------------------------
-- 2. restaurants — invitation-only onboarding, owner-only billing fields
-- ---------------------------------------------------------------------
-- 0004 allowed any authenticated user to INSERT a restaurant owned by
-- themselves, which bypassed developer-issued invitations (0014) and made the
-- owner row optional. Onboarding now goes through claim_restaurant_invite()
-- (SECURITY DEFINER) only.
drop policy if exists "restaurants_owner_insert" on public.restaurants;

-- `plan` is a billing/entitlement field added in 0020. Column-level RLS does
-- not exist, so extend the 0006 owner-only column guard. This is SECURITY
-- INVOKER so the check is testable through `set local role`.
create or replace function public.guard_restaurants_owner_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.owner_id  is distinct from old.owner_id
     or new.slug      is distinct from old.slug
     or new.is_active is distinct from old.is_active
     or new.plan      is distinct from old.plan then

    if not (public.is_privileged_caller() or public.is_owner_of(old.id)) then
      raise exception 'Only the restaurant owner can change slug, owner, active status, or plan'
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

-- ---------------------------------------------------------------------
-- 3. restaurant_staff — no owner rows from a manager INSERT
-- ---------------------------------------------------------------------
-- guard_staff_management (0013) runs on UPDATE/DELETE only. A manager could
-- therefore INSERT a row with role = 'owner' for any user. is_owner_of() is
-- driven by restaurants.owner_id, but the inserted row still grants the
-- owner UI and cannot be removed by the manager afterwards.
create or replace function public.guard_staff_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.is_privileged_caller() then
    return new;
  end if;

  if new.role = 'owner' and not public.is_owner_of(new.restaurant_id) then
    raise exception 'Only the restaurant owner can grant owner access'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_staff_insert on public.restaurant_staff;
create trigger guard_staff_insert
  before insert on public.restaurant_staff
  for each row execute function public.guard_staff_insert();

comment on function public.guard_staff_insert() is
  'BEFORE INSERT guard: owner memberships may only be created by the restaurant owner (or a trusted backend).';

-- ---------------------------------------------------------------------
-- 4. orders — RPC-only inserts, immutable money/identity columns
-- ---------------------------------------------------------------------
-- place_order() (SECURITY DEFINER) is the only supported writer. The old
-- policy let anon/authenticated insert arbitrary totals, statuses, and
-- restaurant ids straight through PostgREST.
drop policy if exists "orders_insert_anon_or_auth" on public.orders;

-- Staff/customers may update workflow fields (status, notes, pickup estimate)
-- but never prices, ownership, or the tracking secret. place_order,
-- claim_guest_order() and the payment RPCs run as trusted definers.
create or replace function public.guard_order_immutable_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.is_privileged_caller() then
    return new;
  end if;

  if new.restaurant_id          is distinct from old.restaurant_id
     or new.table_id               is distinct from old.table_id
     or new.customer_id            is distinct from old.customer_id
     or new.customer_name_snapshot is distinct from old.customer_name_snapshot
     or new.order_number           is distinct from old.order_number
     or new.tracking_token         is distinct from old.tracking_token
     or new.subtotal               is distinct from old.subtotal
     or new.tax                    is distinct from old.tax
     or new.total                  is distinct from old.total
     or new.tip_amount             is distinct from old.tip_amount
     or new.created_at             is distinct from old.created_at then
    raise exception 'order_fields_immutable' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_order_immutable_fields on public.orders;
create trigger guard_order_immutable_fields
  before update on public.orders
  for each row execute function public.guard_order_immutable_fields();

comment on function public.guard_order_immutable_fields() is
  'BEFORE UPDATE guard: prices, restaurant/table/customer identity, order number and tracking token are server-owned.';

-- ---------------------------------------------------------------------
-- 5. order_items / order_item_modifiers — definer RPC only
-- ---------------------------------------------------------------------
-- The insert policies allowed a customer to append arbitrary lines (with
-- arbitrary unit prices) to their own pending order, and staff to append lines
-- to any order at any price. place_order() owns both tables.
drop policy if exists "order_items_insert_own_or_staff" on public.order_items;
drop policy if exists "oim_insert_with_order" on public.order_item_modifiers;

comment on table public.order_items is
  'Order lines. Written only by place_order() / the service role; clients have read access scoped by RLS.';

comment on table public.order_item_modifiers is
  'Selected modifiers per order line. Written only by place_order() / the service role.';

-- ---------------------------------------------------------------------
-- 6. qr_sessions — RPC/back-office only
-- ---------------------------------------------------------------------
-- 0004 allowed anon to read, insert and update every row (using true), which
-- is cross-tenant. The application resolves QR context through
-- resolve_qr_context() and never touches qr_sessions, so table access is
-- closed. Re-enable specific policies if a future feature needs them.
drop policy if exists "qr_sessions_public_read"   on public.qr_sessions;
drop policy if exists "qr_sessions_public_insert" on public.qr_sessions;
drop policy if exists "qr_sessions_public_update" on public.qr_sessions;

revoke all on table public.qr_sessions from anon, authenticated;

comment on table public.qr_sessions is
  'Ephemeral scan sessions. Intentionally RPC/service-role only: RLS is enabled with no client policies.';

-- ---------------------------------------------------------------------
-- 7. refunds — server-side writes only
-- ---------------------------------------------------------------------
-- 0010 anticipated this: refunds are now created by api/refunds.ts with the
-- service role after Stripe succeeds. Leaving client INSERT/UPDATE policies
-- let any kitchen/manager mint a "succeeded" refund row without Stripe, which
-- would falsify reporting. SELECT policies stay (own order / same restaurant).
drop policy if exists "refunds_staff_insert" on public.refunds;
drop policy if exists "refunds_staff_update" on public.refunds;

comment on table public.refunds is
  'Refund records. Written by api/refunds.ts (service role) and the refund webhook; clients are read-only, scoped by RLS.';

-- ---------------------------------------------------------------------
-- 8. menu catalog — staff read, owner/manager write
-- ---------------------------------------------------------------------
-- The admin catalog routes are owner/manager only (RequireRole), but the DB
-- policies used is_staff_of(), so kitchen accounts could rewrite prices
-- directly through PostgREST. Public-read policies are untouched.

-- menu_categories -----------------------------------------------------
drop policy if exists "categories_staff_manage" on public.menu_categories;
drop policy if exists "categories_staff_read"   on public.menu_categories;
drop policy if exists "categories_manager_insert" on public.menu_categories;
drop policy if exists "categories_manager_update" on public.menu_categories;
drop policy if exists "categories_manager_delete" on public.menu_categories;

create policy "categories_staff_read"
  on public.menu_categories for select
  using ( public.is_staff_of(restaurant_id) );

create policy "categories_manager_insert"
  on public.menu_categories for insert
  with check ( public.is_manager_of(restaurant_id) );

create policy "categories_manager_update"
  on public.menu_categories for update
  using      ( public.is_manager_of(restaurant_id) )
  with check ( public.is_manager_of(restaurant_id) );

create policy "categories_manager_delete"
  on public.menu_categories for delete
  using ( public.is_manager_of(restaurant_id) );

-- menu_items ----------------------------------------------------------
drop policy if exists "items_staff_manage" on public.menu_items;
drop policy if exists "items_staff_read"   on public.menu_items;
drop policy if exists "items_manager_insert" on public.menu_items;
drop policy if exists "items_manager_update" on public.menu_items;
drop policy if exists "items_manager_delete" on public.menu_items;

create policy "items_staff_read"
  on public.menu_items for select
  using ( public.is_staff_of(restaurant_id) );

create policy "items_manager_insert"
  on public.menu_items for insert
  with check (
    public.is_manager_of(restaurant_id)
    and exists (
      select 1
      from public.menu_categories c
      where c.id = menu_items.category_id
        and c.restaurant_id = menu_items.restaurant_id
    )
  );

create policy "items_manager_update"
  on public.menu_items for update
  using      ( public.is_manager_of(restaurant_id) )
  with check (
    public.is_manager_of(restaurant_id)
    and exists (
      select 1
      from public.menu_categories c
      where c.id = menu_items.category_id
        and c.restaurant_id = menu_items.restaurant_id
    )
  );

create policy "items_manager_delete"
  on public.menu_items for delete
  using ( public.is_manager_of(restaurant_id) );

-- modifier_groups -----------------------------------------------------
drop policy if exists "modgroups_staff_manage" on public.modifier_groups;
drop policy if exists "modgroups_staff_read"   on public.modifier_groups;
drop policy if exists "modgroups_manager_insert" on public.modifier_groups;
drop policy if exists "modgroups_manager_update" on public.modifier_groups;
drop policy if exists "modgroups_manager_delete" on public.modifier_groups;

create policy "modgroups_staff_read"
  on public.modifier_groups for select
  using ( public.is_staff_of(restaurant_id) );

create policy "modgroups_manager_insert"
  on public.modifier_groups for insert
  with check ( public.is_manager_of(restaurant_id) );

create policy "modgroups_manager_update"
  on public.modifier_groups for update
  using      ( public.is_manager_of(restaurant_id) )
  with check ( public.is_manager_of(restaurant_id) );

create policy "modgroups_manager_delete"
  on public.modifier_groups for delete
  using ( public.is_manager_of(restaurant_id) );

-- modifiers (tenant comes from the parent group) -----------------------
drop policy if exists "modifiers_staff_manage" on public.modifiers;
drop policy if exists "modifiers_staff_read"   on public.modifiers;
drop policy if exists "modifiers_manager_insert" on public.modifiers;
drop policy if exists "modifiers_manager_update" on public.modifiers;
drop policy if exists "modifiers_manager_delete" on public.modifiers;

create policy "modifiers_staff_read"
  on public.modifiers for select
  using (
    exists (
      select 1
      from public.modifier_groups g
      where g.id = modifiers.modifier_group_id
        and public.is_staff_of(g.restaurant_id)
    )
  );

create policy "modifiers_manager_insert"
  on public.modifiers for insert
  with check (
    exists (
      select 1
      from public.modifier_groups g
      where g.id = modifiers.modifier_group_id
        and public.is_manager_of(g.restaurant_id)
    )
  );

create policy "modifiers_manager_update"
  on public.modifiers for update
  using (
    exists (
      select 1
      from public.modifier_groups g
      where g.id = modifiers.modifier_group_id
        and public.is_manager_of(g.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.modifier_groups g
      where g.id = modifiers.modifier_group_id
        and public.is_manager_of(g.restaurant_id)
    )
  );

create policy "modifiers_manager_delete"
  on public.modifiers for delete
  using (
    exists (
      select 1
      from public.modifier_groups g
      where g.id = modifiers.modifier_group_id
        and public.is_manager_of(g.restaurant_id)
    )
  );

-- menu_item_modifier_groups (both ends must belong to a managed tenant) -
drop policy if exists "mimg_staff_manage" on public.menu_item_modifier_groups;
drop policy if exists "mimg_staff_read"   on public.menu_item_modifier_groups;
drop policy if exists "mimg_manager_insert" on public.menu_item_modifier_groups;
drop policy if exists "mimg_manager_delete" on public.menu_item_modifier_groups;

create policy "mimg_staff_read"
  on public.menu_item_modifier_groups for select
  using (
    exists (
      select 1
      from public.menu_items i
      where i.id = menu_item_modifier_groups.menu_item_id
        and public.is_staff_of(i.restaurant_id)
    )
  );

create policy "mimg_manager_insert"
  on public.menu_item_modifier_groups for insert
  with check (
    exists (
      select 1
      from public.menu_items i
      where i.id = menu_item_modifier_groups.menu_item_id
        and public.is_manager_of(i.restaurant_id)
    )
    and exists (
      select 1
      from public.modifier_groups g
      where g.id = menu_item_modifier_groups.modifier_group_id
        and public.is_manager_of(g.restaurant_id)
    )
  );

create policy "mimg_manager_delete"
  on public.menu_item_modifier_groups for delete
  using (
    exists (
      select 1
      from public.menu_items i
      where i.id = menu_item_modifier_groups.menu_item_id
        and public.is_manager_of(i.restaurant_id)
    )
    and exists (
      select 1
      from public.modifier_groups g
      where g.id = menu_item_modifier_groups.modifier_group_id
        and public.is_manager_of(g.restaurant_id)
    )
  );

-- ---------------------------------------------------------------------
-- 9. tables — kitchen may flip operational status only
-- ---------------------------------------------------------------------
-- P06 needs kitchen staff to move a table between available/occupied/etc, so
-- the policy stays is_staff_of(). Structural edits (numbers, QR tokens,
-- deactivation, seats) and inserts/deletes are owner/manager work.
create or replace function public.guard_table_mutations()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  if tg_op = 'DELETE' then
    v_restaurant_id := old.restaurant_id;
  else
    v_restaurant_id := new.restaurant_id;
  end if;

  if public.is_privileged_caller() or public.is_manager_of(v_restaurant_id) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op <> 'UPDATE' then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  if new.restaurant_id  is distinct from old.restaurant_id
     or new.table_number  is distinct from old.table_number
     or new.qr_token      is distinct from old.qr_token
     or new.location_label is distinct from old.location_label
     or new.is_active     is distinct from old.is_active
     or new.seats         is distinct from old.seats
     or new.created_at    is distinct from old.created_at then
    raise exception 'not_authorised' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_table_mutations on public.tables;
create trigger guard_table_mutations
  before insert or update or delete on public.tables
  for each row execute function public.guard_table_mutations();

comment on function public.guard_table_mutations() is
  'Keeps kitchen staff to tables.status changes; owner/manager (or service role) manage the table itself.';

-- ---------------------------------------------------------------------
-- 9b. storage.objects — branding/menu uploads are settings/catalog work
-- ---------------------------------------------------------------------
-- 0005 scoped uploads with is_staff_of(), so kitchen accounts could replace
-- the restaurant logo, cover image, or menu-item photos even though every
-- upload UI sits behind RequireRole(owner|manager). The buckets stay public
-- for reads; writes become owner/manager only.
drop policy if exists "storage_staff_write_restaurant_assets"    on storage.objects;
drop policy if exists "storage_staff_write_menu_items"           on storage.objects;
drop policy if exists "storage_manager_write_restaurant_assets"  on storage.objects;
drop policy if exists "storage_manager_write_menu_items"         on storage.objects;

create policy "storage_manager_write_restaurant_assets"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'restaurant-assets'
    and public.is_manager_of(public.storage_folder_restaurant_id(name))
  )
  with check (
    bucket_id = 'restaurant-assets'
    and public.is_manager_of(public.storage_folder_restaurant_id(name))
  );

create policy "storage_manager_write_menu_items"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'menu-items'
    and public.is_manager_of(public.storage_folder_restaurant_id(name))
  )
  with check (
    bucket_id = 'menu-items'
    and public.is_manager_of(public.storage_folder_restaurant_id(name))
  );

-- ---------------------------------------------------------------------
-- 10. restaurant_locations — settings are owner/manager only
-- ---------------------------------------------------------------------
-- Coordinates and the geofence toggle are configured on /admin/settings,
-- which is behind RequireRole(owner|manager). Kitchen keeps read access so
-- order screens can render location context.
drop policy if exists "restaurant_locations_staff_insert" on public.restaurant_locations;
drop policy if exists "restaurant_locations_staff_update" on public.restaurant_locations;
drop policy if exists "restaurant_locations_staff_delete" on public.restaurant_locations;
drop policy if exists "restaurant_locations_manager_insert" on public.restaurant_locations;
drop policy if exists "restaurant_locations_manager_update" on public.restaurant_locations;
drop policy if exists "restaurant_locations_manager_delete" on public.restaurant_locations;

create policy "restaurant_locations_manager_insert"
  on public.restaurant_locations for insert to authenticated
  with check ( public.is_manager_of(restaurant_id) );

create policy "restaurant_locations_manager_update"
  on public.restaurant_locations for update to authenticated
  using      ( public.is_manager_of(restaurant_id) )
  with check ( public.is_manager_of(restaurant_id) );

create policy "restaurant_locations_manager_delete"
  on public.restaurant_locations for delete to authenticated
  using ( public.is_manager_of(restaurant_id) );

-- ---------------------------------------------------------------------
-- 11. Function grant hygiene
-- ---------------------------------------------------------------------
-- Supabase's default privileges grant EXECUTE on new public functions directly
-- to anon/authenticated, so `revoke ... from public` alone is not enough
-- (same lesson as 0018). claim_guest_order requires a real user, and
-- restaurant_daily_stats is admin-only.
revoke all on function public.claim_guest_order(text) from public, anon;
grant execute on function public.claim_guest_order(text) to authenticated;

revoke all on function public.restaurant_daily_stats(uuid, text) from public, anon;
grant execute on function public.restaurant_daily_stats(uuid, text) to authenticated;

-- Re-assert the 0014 onboarding lockdown (self-serve creation is retired).
revoke all on function public.create_restaurant_with_owner(text, text)
  from public, anon, authenticated;

-- The audit helpers are used inside policies for every role that can reach a
-- row, so they must stay executable. They only report facts about the caller.
grant execute on function public.is_staff_of(uuid)   to anon, authenticated;
grant execute on function public.is_manager_of(uuid) to anon, authenticated;
grant execute on function public.is_owner_of(uuid)   to anon, authenticated;

-- ---------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------
