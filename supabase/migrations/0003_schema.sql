-- =====================================================================
-- Scan-to-Order QR Food Pickup Platform
-- Core schema: enums, tenants, menus, orders, payments, QR sessions.
-- ---------------------------------------------------------------------
-- Run AFTER 0001_profiles.sql and 0002_roles.sql, in the Supabase SQL
-- Editor (or via `supabase db push` with the CLI).
--
-- Reconciled with the tables that already exist in this project:
--   * public.profiles (0001) -- kept as-is; this migration only adds a
--     nullable `phone` column. The planned `full_name` is intentionally
--     NOT added because the app stores `first_name` / `last_name`.
--   * public.roles (0002)    -- kept as the single source of role names.
--     The planned `user_role` enum is NOT created; having both a lookup
--     table and an enum for the same concept would conflict.
--   * The existing handle_new_user() trigger (0001) is left untouched.
--
-- The migration is written to be safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid(), gen_random_bytes()
create extension if not exists "citext";    -- case-insensitive email

-- ---------------------------------------------------------------------
-- 1. Enumerated types
-- ---------------------------------------------------------------------
-- NOTE: no `user_role` enum -- role names live in public.roles (0002).
do $$ begin
  create type staff_role          as enum ('owner', 'manager', 'kitchen');
  create type modifier_selection  as enum ('single', 'multiple');
  create type order_status        as enum (
    'pending',      -- created, payment not yet confirmed
    'confirmed',    -- payment succeeded, sent to kitchen
    'preparing',    -- kitchen accepted
    'ready',        -- ready for pickup
    'completed',    -- picked up by customer
    'cancelled'     -- cancelled (payment refunded if needed)
  );
  create type payment_status      as enum ('pending', 'succeeded', 'failed', 'refunded');
  create type payment_method_type as enum ('card', 'apple_pay', 'google_pay', 'other');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Helper: updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. profiles (already created in 0001; extend, never replace)
-- ---------------------------------------------------------------------
-- `phone` is the only planned profile column that is missing. `full_name`
-- is deliberately skipped in favour of first_name / last_name, and the
-- `role` column already exists as text -> public.roles(name).
alter table public.profiles add column if not exists phone text;

comment on table public.profiles is
  'Public-facing profile data for every human in the system. 1:1 with auth.users.';

-- ---------------------------------------------------------------------
-- 4. restaurants
-- ---------------------------------------------------------------------
create table if not exists public.restaurants (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        uuid        not null references public.profiles(id) on delete restrict,
  slug            text        not null unique,
  name            text        not null,
  description     text,
  logo_url        text,
  cover_image_url text,
  address         text,
  phone           text,
  email           citext,
  currency        text        not null default 'AUD',
  timezone        text        not null default 'Australia/Sydney',
  tax_rate        numeric(5,4) not null default 0.1000 check (tax_rate >= 0 and tax_rate <= 1),
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_restaurants_owner  on public.restaurants(owner_id);
create index if not exists idx_restaurants_active on public.restaurants(is_active) where is_active;

drop trigger if exists trg_restaurants_updated_at on public.restaurants;
create trigger trg_restaurants_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. restaurant_staff (M:N profiles <-> restaurants, with role)
-- ---------------------------------------------------------------------
create table if not exists public.restaurant_staff (
  id            uuid       primary key default gen_random_uuid(),
  restaurant_id uuid       not null references public.restaurants(id) on delete cascade,
  user_id       uuid       not null references public.profiles(id)    on delete cascade,
  role          staff_role not null default 'manager',
  is_active     boolean    not null default true,
  created_at    timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create index if not exists idx_staff_restaurant on public.restaurant_staff(restaurant_id) where is_active;
create index if not exists idx_staff_user       on public.restaurant_staff(user_id)       where is_active;

-- ---------------------------------------------------------------------
-- 6. tables (physical tables / counters per restaurant)
-- ---------------------------------------------------------------------
create table if not exists public.tables (
  id             uuid        primary key default gen_random_uuid(),
  restaurant_id  uuid        not null references public.restaurants(id) on delete cascade,
  table_number   text        not null,
  qr_token       text        not null unique default encode(gen_random_bytes(8), 'hex'),
  location_label text,                                   -- 'Patio', 'Bar', etc.
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now(),
  unique (restaurant_id, table_number)
);

create index if not exists idx_tables_restaurant on public.tables(restaurant_id) where is_active;

-- ---------------------------------------------------------------------
-- 7. menu_categories
-- ---------------------------------------------------------------------
create table if not exists public.menu_categories (
  id            uuid        primary key default gen_random_uuid(),
  restaurant_id uuid        not null references public.restaurants(id) on delete cascade,
  name          text        not null,
  description   text,
  image_url     text,
  display_order int         not null default 0,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_categories_restaurant
  on public.menu_categories(restaurant_id, display_order) where is_active;

-- ---------------------------------------------------------------------
-- 8. menu_items
-- ---------------------------------------------------------------------
create table if not exists public.menu_items (
  id                uuid          primary key default gen_random_uuid(),
  restaurant_id     uuid          not null references public.restaurants(id)    on delete cascade,
  category_id       uuid          not null references public.menu_categories(id) on delete restrict,
  name              text          not null,
  description       text,
  price             numeric(10,2) not null check (price >= 0),
  image_url         text,
  is_available      boolean       not null default true,
  display_order     int           not null default 0,
  prep_time_minutes int           not null default 10 check (prep_time_minutes >= 0),
  allergens         text[]        not null default '{}',
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create index if not exists idx_items_restaurant on public.menu_items(restaurant_id) where is_available;
create index if not exists idx_items_category   on public.menu_items(category_id, display_order) where is_available;

drop trigger if exists trg_menu_items_updated_at on public.menu_items;
create trigger trg_menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 9. modifier_groups
-- ---------------------------------------------------------------------
create table if not exists public.modifier_groups (
  id             uuid               primary key default gen_random_uuid(),
  restaurant_id  uuid               not null references public.restaurants(id) on delete cascade,
  name           text               not null,
  selection_type modifier_selection not null default 'single',
  min_selections int                not null default 0 check (min_selections >= 0),
  max_selections int                not null default 1 check (max_selections >= min_selections),
  is_required    boolean            not null default false,
  display_order  int                not null default 0,
  created_at     timestamptz        not null default now()
);

create index if not exists idx_modgroups_restaurant
  on public.modifier_groups(restaurant_id, display_order);

-- ---------------------------------------------------------------------
-- 10. modifiers
-- ---------------------------------------------------------------------
create table if not exists public.modifiers (
  id                uuid          primary key default gen_random_uuid(),
  modifier_group_id uuid          not null references public.modifier_groups(id) on delete cascade,
  name              text          not null,
  price_adjustment  numeric(10,2) not null default 0,
  is_available      boolean       not null default true,
  display_order     int           not null default 0
);

create index if not exists idx_modifiers_group
  on public.modifiers(modifier_group_id, display_order) where is_available;

-- ---------------------------------------------------------------------
-- 11. menu_item_modifier_groups (M:N link)
-- ---------------------------------------------------------------------
create table if not exists public.menu_item_modifier_groups (
  menu_item_id      uuid not null references public.menu_items(id)      on delete cascade,
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  display_order     int  not null default 0,
  primary key (menu_item_id, modifier_group_id)
);

create index if not exists idx_mimg_group on public.menu_item_modifier_groups(modifier_group_id);

-- ---------------------------------------------------------------------
-- 12. orders
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id                   uuid         primary key default gen_random_uuid(),
  restaurant_id        uuid         not null references public.restaurants(id) on delete restrict,
  table_id             uuid                  references public.tables(id)       on delete set null,
  customer_id          uuid                  references public.profiles(id)     on delete set null,
  order_number         text         not null,
  status               order_status not null default 'pending',
  subtotal             numeric(10,2) not null default 0 check (subtotal >= 0),
  tax                  numeric(10,2) not null default 0 check (tax      >= 0),
  total                numeric(10,2) not null default 0 check (total    >= 0),
  notes                text,
  pickup_time_estimate timestamptz,
  created_at           timestamptz  not null default now(),
  updated_at           timestamptz  not null default now(),
  completed_at         timestamptz
);

-- Human-friendly order numbers must be unique per restaurant
create unique index if not exists uq_orders_number_per_restaurant
  on public.orders(restaurant_id, order_number);

create index if not exists idx_orders_restaurant_status_created
  on public.orders(restaurant_id, status, created_at desc);

create index if not exists idx_orders_customer
  on public.orders(customer_id, created_at desc) where customer_id is not null;

create index if not exists idx_orders_table
  on public.orders(table_id, created_at desc) where table_id is not null;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 13. order_items (line items, with menu-item snapshot)
-- ---------------------------------------------------------------------
create table if not exists public.order_items (
  id                  uuid          primary key default gen_random_uuid(),
  order_id            uuid          not null references public.orders(id)    on delete cascade,
  menu_item_id        uuid          not null references public.menu_items(id) on delete restrict,
  item_name_snapshot  text          not null,
  unit_price_snapshot numeric(10,2) not null check (unit_price_snapshot >= 0),
  quantity            int           not null check (quantity > 0),
  subtotal            numeric(10,2) not null check (subtotal >= 0),
  notes               text
);

create index if not exists idx_order_items_order on public.order_items(order_id);

-- ---------------------------------------------------------------------
-- 14. order_item_modifiers (chosen modifiers, with snapshot)
-- ---------------------------------------------------------------------
create table if not exists public.order_item_modifiers (
  id                        uuid          primary key default gen_random_uuid(),
  order_item_id             uuid          not null references public.order_items(id) on delete cascade,
  modifier_id               uuid          not null references public.modifiers(id)    on delete restrict,
  modifier_name_snapshot    text          not null,
  price_adjustment_snapshot numeric(10,2) not null default 0
);

create index if not exists idx_oim_order_item on public.order_item_modifiers(order_item_id);

-- ---------------------------------------------------------------------
-- 15. payments
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id                       uuid              primary key default gen_random_uuid(),
  order_id                 uuid              not null references public.orders(id) on delete restrict,
  stripe_payment_intent_id text              unique,
  status                   payment_status    not null default 'pending',
  amount                   numeric(10,2)     not null check (amount >= 0),
  currency                 text              not null default 'AUD',
  payment_method_type      payment_method_type,
  receipt_url              text,
  failure_reason           text,
  paid_at                  timestamptz,
  created_at               timestamptz       not null default now(),
  updated_at               timestamptz       not null default now()
);

create index if not exists idx_payments_order  on public.payments(order_id);
create index if not exists idx_payments_status on public.payments(status);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 16. qr_sessions (ephemeral session for a scanned table)
-- ---------------------------------------------------------------------
create table if not exists public.qr_sessions (
  id            uuid        primary key default gen_random_uuid(),
  table_id      uuid        not null references public.tables(id) on delete cascade,
  session_token text        not null unique default encode(gen_random_bytes(16), 'hex'),
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '6 hours')
);

create index if not exists idx_qr_sessions_table
  on public.qr_sessions(table_id, started_at desc);

-- NOTE: the planned partial index used `where expires_at > now()`, which
-- Postgres rejects (index predicates must be IMMUTABLE). A plain index on
-- expires_at serves the same "find live/expired sessions" lookups.
create index if not exists idx_qr_sessions_expires
  on public.qr_sessions(expires_at);

-- ---------------------------------------------------------------------
-- End of schema
-- ---------------------------------------------------------------------
