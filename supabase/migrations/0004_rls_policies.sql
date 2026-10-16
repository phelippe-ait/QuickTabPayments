-- =====================================================================
-- Scan-to-Order QR Food Pickup Platform
-- Row Level Security policies (Supabase / PostgreSQL)
-- ---------------------------------------------------------------------
-- Run AFTER 0003_schema.sql.
--
-- Mental model:
--   * A customer browsing the menu (anon or authenticated) can READ menu
--     data for any ACTIVE restaurant.
--   * Only the restaurant's OWN staff can WRITE menu data.
--   * Customers can only SEE their own orders; staff can see ALL orders
--     for restaurants they belong to.
--   * Payments are write-restricted to the service role (server-side
--     webhook handler) and readable by the customer who owns the order.
--
-- NOTE ON profiles: its RLS policies already exist in 0001_profiles.sql
-- ("read own profile" / "update own profile") plus the role-escalation
-- trigger in 0002_roles.sql, so profiles is intentionally left out here.
--
-- The migration is written to be safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helper functions
-- ---------------------------------------------------------------------

-- True if the current user (auth.uid()) is an active staff member of
-- the restaurant passed in.
create or replace function public.is_staff_of(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_staff rs
    where rs.restaurant_id = p_restaurant_id
      and rs.user_id       = auth.uid()
      and rs.is_active
  );
$$;

-- True if the current user is the owner of the restaurant.
create or replace function public.is_owner_of(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurants r
    where r.id       = p_restaurant_id
      and r.owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- 1. restaurants
-- ---------------------------------------------------------------------
alter table public.restaurants enable row level security;

drop policy if exists "restaurants_public_read_active" on public.restaurants;
drop policy if exists "restaurants_owner_update"        on public.restaurants;
drop policy if exists "restaurants_owner_insert"        on public.restaurants;
drop policy if exists "restaurants_owner_delete"        on public.restaurants;

-- Anyone (including anon) can read an active restaurant -- needed so
-- the customer app can show restaurant info when they scan a QR.
create policy "restaurants_public_read_active"
  on public.restaurants for select
  using ( is_active );

-- Only the owner can modify the restaurant record.
create policy "restaurants_owner_update"
  on public.restaurants for update
  using      ( owner_id = auth.uid() )
  with check ( owner_id = auth.uid() );

create policy "restaurants_owner_insert"
  on public.restaurants for insert
  with check ( owner_id = auth.uid() );

create policy "restaurants_owner_delete"
  on public.restaurants for delete
  using ( owner_id = auth.uid() );

-- ---------------------------------------------------------------------
-- 2. restaurant_staff
-- ---------------------------------------------------------------------
alter table public.restaurant_staff enable row level security;

drop policy if exists "staff_read_self_or_owner" on public.restaurant_staff;
drop policy if exists "staff_owner_manage"       on public.restaurant_staff;

-- A staff member can see their own memberships; the owner can see all
-- memberships of restaurants they own.
create policy "staff_read_self_or_owner"
  on public.restaurant_staff for select
  using (
    user_id = auth.uid()
    or public.is_owner_of(restaurant_id)
  );

-- Only the restaurant owner can add/remove staff.
create policy "staff_owner_manage"
  on public.restaurant_staff for all
  using      ( public.is_owner_of(restaurant_id) )
  with check ( public.is_owner_of(restaurant_id) );

-- ---------------------------------------------------------------------
-- 3. tables
-- ---------------------------------------------------------------------
alter table public.tables enable row level security;

drop policy if exists "tables_public_read"  on public.tables;
drop policy if exists "tables_staff_manage" on public.tables;

-- Public can read tables to look up the table referenced by a QR scan.
create policy "tables_public_read"
  on public.tables for select
  using ( is_active );

-- Staff can manage tables of their restaurant.
create policy "tables_staff_manage"
  on public.tables for all
  using      ( public.is_staff_of(restaurant_id) )
  with check ( public.is_staff_of(restaurant_id) );

-- ---------------------------------------------------------------------
-- 4. menu_categories
-- ---------------------------------------------------------------------
alter table public.menu_categories enable row level security;

drop policy if exists "categories_public_read"  on public.menu_categories;
drop policy if exists "categories_staff_manage" on public.menu_categories;

create policy "categories_public_read"
  on public.menu_categories for select
  using ( is_active );

create policy "categories_staff_manage"
  on public.menu_categories for all
  using      ( public.is_staff_of(restaurant_id) )
  with check ( public.is_staff_of(restaurant_id) );

-- ---------------------------------------------------------------------
-- 5. menu_items
-- ---------------------------------------------------------------------
alter table public.menu_items enable row level security;

drop policy if exists "items_public_read"  on public.menu_items;
drop policy if exists "items_staff_manage" on public.menu_items;

create policy "items_public_read"
  on public.menu_items for select
  using ( is_available );

create policy "items_staff_manage"
  on public.menu_items for all
  using      ( public.is_staff_of(restaurant_id) )
  with check ( public.is_staff_of(restaurant_id) );

-- ---------------------------------------------------------------------
-- 6. modifier_groups / modifiers / menu_item_modifier_groups
-- ---------------------------------------------------------------------
alter table public.modifier_groups           enable row level security;
alter table public.modifiers                 enable row level security;
alter table public.menu_item_modifier_groups enable row level security;

drop policy if exists "modgroups_public_read"  on public.modifier_groups;
drop policy if exists "modgroups_staff_manage" on public.modifier_groups;
create policy "modgroups_public_read"
  on public.modifier_groups for select using ( true );
create policy "modgroups_staff_manage"
  on public.modifier_groups for all
  using      ( public.is_staff_of(restaurant_id) )
  with check ( public.is_staff_of(restaurant_id) );

drop policy if exists "modifiers_public_read"  on public.modifiers;
drop policy if exists "modifiers_staff_manage" on public.modifiers;
create policy "modifiers_public_read"
  on public.modifiers for select using ( is_available );
-- Writes must be performed by staff of the *parent* group:
create policy "modifiers_staff_manage"
  on public.modifiers for all
  using (
    exists (
      select 1
      from public.modifier_groups g
      where g.id = modifiers.modifier_group_id
        and public.is_staff_of(g.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.modifier_groups g
      where g.id = modifiers.modifier_group_id
        and public.is_staff_of(g.restaurant_id)
    )
  );

drop policy if exists "mimg_public_read"  on public.menu_item_modifier_groups;
drop policy if exists "mimg_staff_manage" on public.menu_item_modifier_groups;
create policy "mimg_public_read"
  on public.menu_item_modifier_groups for select using ( true );
create policy "mimg_staff_manage"
  on public.menu_item_modifier_groups for all
  using (
    exists (
      select 1
      from public.menu_items i
      where i.id = menu_item_modifier_groups.menu_item_id
        and public.is_staff_of(i.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.menu_items i
      where i.id = menu_item_modifier_groups.menu_item_id
        and public.is_staff_of(i.restaurant_id)
    )
  );

-- ---------------------------------------------------------------------
-- 7. orders / order_items / order_item_modifiers
-- ---------------------------------------------------------------------
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_item_modifiers enable row level security;

-- ORDERS ---------------------------------------------------------------
drop policy if exists "orders_insert_anon_or_auth"  on public.orders;
drop policy if exists "orders_select_own_or_staff"  on public.orders;
drop policy if exists "orders_update_staff"         on public.orders;
drop policy if exists "orders_update_own_pending"   on public.orders;

-- Anyone can place an order (guest checkout allowed). The customer_id,
-- if present, must be the calling user.
create policy "orders_insert_anon_or_auth"
  on public.orders for insert
  with check (
    customer_id is null
    or customer_id = auth.uid()
  );

-- Customer sees only their own orders. Staff see all orders for their
-- restaurant. Kitchen displays rely on this.
create policy "orders_select_own_or_staff"
  on public.orders for select
  using (
    customer_id = auth.uid()
    or public.is_staff_of(restaurant_id)
  );

-- Staff can update any field (e.g. change status, set completed_at).
create policy "orders_update_staff"
  on public.orders for update
  using      ( public.is_staff_of(restaurant_id) )
  with check ( public.is_staff_of(restaurant_id) );

-- A customer may cancel their own order while it is still pending.
create policy "orders_update_own_pending"
  on public.orders for update
  using      ( customer_id = auth.uid() and status = 'pending' )
  with check ( customer_id = auth.uid() and status = 'cancelled' );

-- ORDER_ITEMS ---------------------------------------------------------
drop policy if exists "order_items_insert_own_or_staff" on public.order_items;
drop policy if exists "order_items_select_own_or_staff" on public.order_items;

-- Inserts are only via staff or by the customer who owns the parent
-- order while it is still pending.
create policy "order_items_insert_own_or_staff"
  on public.order_items for insert
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and (
              public.is_staff_of(o.restaurant_id)
           or (o.customer_id = auth.uid() and o.status = 'pending')
        )
    )
  );

create policy "order_items_select_own_or_staff"
  on public.order_items for select
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and (
              o.customer_id = auth.uid()
           or public.is_staff_of(o.restaurant_id)
        )
    )
  );

-- ORDER_ITEM_MODIFIERS ------------------------------------------------
drop policy if exists "oim_insert_with_order" on public.order_item_modifiers;
drop policy if exists "oim_select_with_order" on public.order_item_modifiers;

create policy "oim_insert_with_order"
  on public.order_item_modifiers for insert
  with check (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_modifiers.order_item_id
        and (
              public.is_staff_of(o.restaurant_id)
           or (o.customer_id = auth.uid() and o.status = 'pending')
        )
    )
  );

create policy "oim_select_with_order"
  on public.order_item_modifiers for select
  using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_modifiers.order_item_id
        and (
              o.customer_id = auth.uid()
           or public.is_staff_of(o.restaurant_id)
        )
    )
  );

-- ---------------------------------------------------------------------
-- 8. payments
-- ---------------------------------------------------------------------
alter table public.payments enable row level security;

drop policy if exists "payments_select_own_or_staff" on public.payments;
-- No INSERT/UPDATE policy for end users.
-- Payment writes happen from the server using the SERVICE ROLE key
-- (Stripe webhook handler), which bypasses RLS.

create policy "payments_select_own_or_staff"
  on public.payments for select
  using (
    exists (
      select 1
      from public.orders o
      where o.id = payments.order_id
        and (
              o.customer_id = auth.uid()
           or public.is_staff_of(o.restaurant_id)
        )
    )
  );

-- ---------------------------------------------------------------------
-- 9. qr_sessions
-- ---------------------------------------------------------------------
alter table public.qr_sessions enable row level security;

drop policy if exists "qr_sessions_public_read"   on public.qr_sessions;
drop policy if exists "qr_sessions_public_insert" on public.qr_sessions;
drop policy if exists "qr_sessions_public_update" on public.qr_sessions;

-- Anyone with a valid session token can read/update their session.
-- We pass session_token via a header and compare in app code; for
-- simplicity at MVP we just allow anon read/insert/update.
create policy "qr_sessions_public_read"
  on public.qr_sessions for select
  using ( true );

create policy "qr_sessions_public_insert"
  on public.qr_sessions for insert
  with check ( true );

create policy "qr_sessions_public_update"
  on public.qr_sessions for update
  using ( true )
  with check ( true );

-- ---------------------------------------------------------------------
-- 10. Realtime publication
-- ---------------------------------------------------------------------
-- Supabase Realtime listens to the `supabase_realtime` publication.
-- Add the operational tables so kitchen displays and order-status UIs
-- receive live updates.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Add tables idempotently
do $$
begin
  begin alter publication supabase_realtime add table public.orders;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.order_items;     exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.menu_items;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.menu_categories; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.payments;        exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------------
-- End of RLS policies
-- ---------------------------------------------------------------------
