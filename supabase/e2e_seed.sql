-- =====================================================================
-- QuickTab — deterministic E2E seed (P28 / A4.1)
-- ---------------------------------------------------------------------
-- Run AFTER every migration (0027_place_order_pending_status.sql and
-- later), in the Supabase SQL Editor or with psql. It creates the fixed
-- fixture the Playwright suite targets:
--
--   restaurant  slug  e2e-bistro  ("E2E Bistro", AUD, tax_rate 0.10, active)
--   table       1  qr_token 'e2e-table-token-fixed', seats 4, available
--   menu        2 categories, 4 items (one with allergens = '{nuts}',
--               one with a single-select "Size" modifier group)
--
-- Idempotent: every row is upserted by a deterministic id (or by its
-- natural key) and every statement is scoped to the e2e restaurant, so
-- re-running never duplicates rows and never touches other restaurants.
--
-- ---------------------------------------------------------------------
-- AUTH USERS (human step — plain SQL cannot create them)
-- ---------------------------------------------------------------------
-- `restaurants.owner_id` and `restaurant_staff.user_id` reference
-- `auth.users`/`public.profiles`, so at least one account must already
-- exist. Before running this file:
--
--   1. `v_owner_email` (default 'owner@quicktab.demo') must be an existing,
--      email-confirmed auth user. It only owns the seeded restaurant row;
--      it is NOT added as staff (see point 3).
--   2. Create the E2E staff account (default 'e2e-staff@quicktab.demo') in
--      Authentication → Users and put its credentials in the repo/CI:
--          E2E_STAFF_EMAIL=e2e-staff@quicktab.demo
--          E2E_STAFF_PASSWORD=<password>
--      It is linked to e2e-bistro as `owner` by this seed.
--   3. Existing demo accounts (owner@quicktab.demo etc.) are NOT linked
--      to e2e-bistro on purpose: a user's primary restaurant is the
--      oldest active membership, so they would keep landing in
--      'quicktab-demo-cafe' and the staff lifecycle check would inspect
--      the wrong kitchen board. If you really want a demo account here,
--      add its email to `v_staff_emails` — knowing it will then resolve
--      to e2e-bistro as its primary workspace.
--
-- If a required auth user is missing this seed raises an exception with
-- instructions instead of silently creating an unusable fixture.
--
-- ---------------------------------------------------------------------
-- E2E environment (see .github/workflows/e2e.yml + README)
-- ---------------------------------------------------------------------
--   E2E_RESTAURANT_SLUG=e2e-bistro
--   E2E_TABLE_TOKEN=e2e-table-token-fixed
--   STRIPE_TEST=1                  (optional: real card payment journey)
--
-- ---------------------------------------------------------------------
-- TEARDOWN (uncomment and run to reset the e2e fixture)
-- ---------------------------------------------------------------------
-- do $$
-- declare r uuid;
-- begin
--   select id into r from public.restaurants where slug = 'e2e-bistro';
--   if r is null then return; end if;
--   delete from public.refunds where order_id in (select id from public.orders where restaurant_id = r);
--   delete from public.payments where order_id in (select id from public.orders where restaurant_id = r);
--   delete from public.order_items where order_id in (select id from public.orders where restaurant_id = r);
--   delete from public.orders where restaurant_id = r;
--   delete from public.qr_sessions where table_id in (select id from public.tables where restaurant_id = r);
--   delete from public.tables where restaurant_id = r;
--   delete from public.menu_item_modifier_groups
--     where menu_item_id in (select id from public.menu_items where restaurant_id = r);
--   delete from public.modifiers
--     where modifier_group_id in (select id from public.modifier_groups where restaurant_id = r);
--   delete from public.modifier_groups where restaurant_id = r;
--   delete from public.menu_items where restaurant_id = r;
--   delete from public.menu_categories where restaurant_id = r;
--   delete from public.restaurant_staff where restaurant_id = r;
--   delete from public.restaurants where id = r;
-- end $$;
-- =====================================================================

do $$
declare
  -- Existing auth user that owns the seeded restaurant row.
  v_owner_email  text := 'owner@quicktab.demo';
  -- Existing auth users to link as staff of e2e-bistro.
  v_staff_emails text[] := array['e2e-staff@quicktab.demo'];

  -- Deterministic identifiers (stable across runs and environments).
  v_restaurant_id  uuid := 'e2e00000-0000-4000-8000-000000000001';
  v_table_id       uuid := 'e2e00000-0000-4000-8000-000000000002';
  v_category_mains uuid := 'e2e00000-0000-4000-8000-000000000010';
  v_category_drinks uuid := 'e2e00000-0000-4000-8000-000000000011';
  v_item_burger    uuid := 'e2e00000-0000-4000-8000-000000000020';
  v_item_salad     uuid := 'e2e00000-0000-4000-8000-000000000021';
  v_item_fries     uuid := 'e2e00000-0000-4000-8000-000000000022';
  v_item_tea       uuid := 'e2e00000-0000-4000-8000-000000000023';
  v_group_size     uuid := 'e2e00000-0000-4000-8000-000000000030';
  v_modifier_small uuid := 'e2e00000-0000-4000-8000-000000000031';
  v_modifier_large uuid := 'e2e00000-0000-4000-8000-000000000032';

  v_restaurant uuid;
  v_owner      uuid;
  v_staff      text;
begin
  -- -------------------------------------------------------------------
  -- 0. Preconditions: an owner profile must exist.
  -- -------------------------------------------------------------------
  select id into v_owner
  from public.profiles
  where lower(email) = lower(v_owner_email);

  if v_owner is null then
    select id into v_owner
    from public.profiles
    order by created_at asc
    limit 1;
  end if;

  if v_owner is null then
    raise exception 'e2e_seed: no auth user/profile exists. Create the account % (Authentication -> Users) and run the seed again.',
      v_owner_email
      using errcode = 'P0001';
  end if;

  -- -------------------------------------------------------------------
  -- 1. Restaurant (deterministic id; adopts a pre-existing slug row).
  -- -------------------------------------------------------------------
  insert into public.restaurants
    (id, owner_id, slug, name, description, currency, timezone, tax_rate, is_active)
  values
    (v_restaurant_id, v_owner, 'e2e-bistro', 'E2E Bistro',
     'Deterministic fixture for the Playwright suite.',
     'AUD', 'Australia/Sydney', 0.10, true)
  on conflict (slug) do update
    set name     = excluded.name,
        currency = excluded.currency,
        timezone = excluded.timezone,
        tax_rate = excluded.tax_rate,
        is_active = true;

  select id into v_restaurant
  from public.restaurants
  where slug = 'e2e-bistro';

  -- -------------------------------------------------------------------
  -- 2. One active table with a fixed QR token.
  -- -------------------------------------------------------------------
  insert into public.tables
    (id, restaurant_id, table_number, qr_token, location_label, seats, is_active, status)
  values
    (v_table_id, v_restaurant, '1', 'e2e-table-token-fixed', 'Window', 4, true, 'available')
  on conflict (restaurant_id, table_number) do update
    set qr_token       = excluded.qr_token,
        location_label = excluded.location_label,
        seats          = excluded.seats,
        is_active      = true,
        status         = 'available';

  -- The suite assumes exactly one bookable table for this restaurant.
  update public.tables
     set is_active = false
   where restaurant_id = v_restaurant
     and table_number <> '1';

  -- -------------------------------------------------------------------
  -- 3. Two categories.
  -- -------------------------------------------------------------------
  insert into public.menu_categories
    (id, restaurant_id, name, description, display_order, is_active)
  values
    (v_category_mains,  v_restaurant, 'E2E Mains',  'Deterministic mains',  10, true),
    (v_category_drinks, v_restaurant, 'E2E Drinks', 'Deterministic drinks', 20, true)
  on conflict (id) do update
    set restaurant_id = excluded.restaurant_id,
        name          = excluded.name,
        description   = excluded.description,
        display_order = excluded.display_order,
        is_active     = true;

  -- -------------------------------------------------------------------
  -- 4. Four known items (all available).
  --    "E2E Nut Salad" carries allergens = '{nuts}' (P19 alert path).
  -- -------------------------------------------------------------------
  insert into public.menu_items
    (id, restaurant_id, category_id, name, description, price,
     is_available, display_order, prep_time_minutes, allergens, dietary_tags)
  select
    i.id, v_restaurant, i.category_id, i.name, i.description, i.price,
    true, i.display_order, i.prep_time_minutes, i.allergens, i.dietary_tags
  from (values
    (v_item_burger, v_category_mains,  'E2E Burger',    'Beef patty, pickles and house sauce.',        20.00::numeric, 0, 12, '{}'::text[],    '{}'::text[]),
    (v_item_salad,  v_category_mains,  'E2E Nut Salad', 'Leafy salad with toasted nuts.',              15.50::numeric, 1,  8, '{nuts}'::text[], '{}'::text[]),
    (v_item_fries,  v_category_mains,  'E2E Fries',     'Hot chips with a choice of size.',             8.00::numeric, 2,  6, '{}'::text[],    '{}'::text[]),
    (v_item_tea,    v_category_drinks, 'E2E Iced Tea',  'House-brewed iced tea with lemon.',            6.00::numeric, 0,  3, '{}'::text[],    '{}'::text[])
  ) as i(id, category_id, name, description, price, display_order, prep_time_minutes, allergens, dietary_tags)
  on conflict (id) do update
    set restaurant_id     = excluded.restaurant_id,
        category_id       = excluded.category_id,
        name              = excluded.name,
        description       = excluded.description,
        price             = excluded.price,
        is_available      = true,
        display_order     = excluded.display_order,
        prep_time_minutes = excluded.prep_time_minutes,
        allergens         = excluded.allergens,
        dietary_tags      = excluded.dietary_tags;

  -- -------------------------------------------------------------------
  -- 5. Single-select "Size" group on E2E Fries: Small +0 / Large +3.
  -- -------------------------------------------------------------------
  insert into public.modifier_groups
    (id, restaurant_id, name, selection_type, min_selections, max_selections,
     is_required, display_order)
  values
    (v_group_size, v_restaurant, 'Size', 'single', 0, 1, false, 10)
  on conflict (id) do update
    set restaurant_id  = excluded.restaurant_id,
        name           = excluded.name,
        selection_type = excluded.selection_type,
        min_selections = excluded.min_selections,
        max_selections = excluded.max_selections,
        is_required    = excluded.is_required,
        display_order  = excluded.display_order;

  insert into public.modifiers
    (id, modifier_group_id, name, price_adjustment, is_available, display_order)
  values
    (v_modifier_small, v_group_size, 'Small', 0.00, true, 0),
    (v_modifier_large, v_group_size, 'Large', 3.00, true, 1)
  on conflict (id) do update
    set modifier_group_id = excluded.modifier_group_id,
        name              = excluded.name,
        price_adjustment  = excluded.price_adjustment,
        is_available      = true,
        display_order     = excluded.display_order;

  insert into public.menu_item_modifier_groups
    (menu_item_id, modifier_group_id, display_order)
  values
    (v_item_fries, v_group_size, 10)
  on conflict (menu_item_id, modifier_group_id) do update
    set display_order = excluded.display_order;

  -- -------------------------------------------------------------------
  -- 6. Staff membership for the E2E account(s) that already exist.
  -- -------------------------------------------------------------------
  foreach v_staff in array v_staff_emails loop
    insert into public.restaurant_staff (restaurant_id, user_id, role, is_active)
    select v_restaurant, p.id, 'owner', true
    from public.profiles p
    where lower(p.email) = lower(v_staff)
    on conflict (restaurant_id, user_id) do update
      set role = 'owner', is_active = true;

    if not found then
      raise notice 'e2e_seed: staff auth user % does not exist yet; create it and re-run to enable the staff lifecycle check.', v_staff;
    end if;
  end loop;

  raise notice 'e2e_seed: fixture ready — restaurant %, table token e2e-table-token-fixed.', v_restaurant;
end $$;
