-- =====================================================================
-- QuickTab — RLS / policy verification script
-- ---------------------------------------------------------------------
-- Run in the Supabase SQL editor after applying each DB milestone.
-- Replace every <...> placeholder with real ids from the helper queries.
--
-- These checks impersonate users through `request.jwt.claims` + `set role`
-- inside a transaction, then roll back, so they never change data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helper queries (run first)
-- ---------------------------------------------------------------------
-- select id, slug, name from public.restaurants order by created_at;
-- select rs.user_id, rs.role, rs.is_active, p.email
--   from public.restaurant_staff rs
--   join public.profiles p on p.id = rs.user_id
--  where rs.restaurant_id = '<restaurant-uuid>'
--  order by rs.created_at;

-- ---------------------------------------------------------------------
-- M2 — manager restaurant edits, onboarding grants, storage writes
-- ---------------------------------------------------------------------
-- <restaurant-uuid>   demo restaurant id (slug quicktab-demo-cafe)
-- <owner-user-uuid>   owner's auth user id
-- <manager-user-uuid> an active manager's auth user id

-- (a) Manager may update profile fields. Expected: UPDATE 1.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
update public.restaurants
   set description = description
 where id = '<restaurant-uuid>';
rollback;

-- (b) Manager may NOT change the slug. Expected: ERROR 42501.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
update public.restaurants
   set slug = 'hacked-slug'
 where id = '<restaurant-uuid>';
rollback;

-- (c) Anonymous storage inserts are denied. Expected: RLS violation.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
insert into storage.objects (bucket_id, name)
values ('restaurant-assets', '<restaurant-uuid>/anon-check.png');
rollback;

-- (d) Staff may write inside their own restaurant folder. Expected: 1 row.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
insert into storage.objects (bucket_id, name, owner)
values ('restaurant-assets', '<restaurant-uuid>/rls-check.png', '<manager-user-uuid>')
returning id;
rollback;

-- (e) Staff may NOT write into another restaurant's folder.
-- Expected: RLS violation (uses a random, unrelated uuid).
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
insert into storage.objects (bucket_id, name, owner)
values ('restaurant-assets', '00000000-0000-0000-0000-000000000000/nope.png', '<manager-user-uuid>');
rollback;

-- (f) Function grants. Expected: anon false, authenticated true.
select
  has_function_privilege(
    'anon', 'public.create_restaurant_with_owner(text,text)', 'execute'
  ) as anon_can_onboard,
  has_function_privilege(
    'authenticated', 'public.create_restaurant_with_owner(text,text)', 'execute'
  ) as authenticated_can_onboard;

-- (g) Manager helper. Expected: true for the manager, false for a kitchen user.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select public.is_manager_of('<restaurant-uuid>') as manager_is_manager;
rollback;

-- ---------------------------------------------------------------------
-- M4 — tables.seats + staff writes
-- ---------------------------------------------------------------------

-- (h) Staff may create a table with seats. Expected: 1 row.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
insert into public.tables (restaurant_id, table_number, location_label, seats)
values (
  '<restaurant-uuid>',
  'RLS-' || substr(gen_random_uuid()::text, 1, 8),
  'Indoors',
  2
)
returning id, seats, qr_token;
rollback;

-- (i) Anonymous table writes are denied. Expected: RLS violation.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
insert into public.tables (restaurant_id, table_number)
values ('<restaurant-uuid>', 'ANON-CHECK');
rollback;

-- ---------------------------------------------------------------------
-- M5 — order reads and daily stats
-- ---------------------------------------------------------------------

-- (j) Staff can read their restaurant's orders. Expected: a positive count.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select count(*) as visible_orders
from public.orders
where restaurant_id = '<restaurant-uuid>';
rollback;

-- (k) Staff of another restaurant cannot read these orders.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<other-staff-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select count(*) as should_be_zero
from public.orders
where restaurant_id = '<restaurant-uuid>';
rollback;

-- (l) Daily stats returns two rows for staff. Expected: today + yesterday.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select * from public.restaurant_daily_stats('<restaurant-uuid>', 'Australia/Sydney');
rollback;

-- ---------------------------------------------------------------------
-- M6 — refunds
-- ---------------------------------------------------------------------

-- (m) Over-refunding a succeeded payment is rejected by the trigger.
-- Expected: ERROR 23514 "Refund amount exceeds the remaining payment balance".
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
insert into public.refunds (order_id, payment_id, amount, reason)
select o.id, p.id, 999, 'RLS over-refund check'
from public.orders o
join public.payments p on p.order_id = o.id
where o.restaurant_id = '<restaurant-uuid>'
  and p.status = 'succeeded'
limit 1;
rollback;

-- (n) Staff can read refund rows for their restaurant. Expected: rows.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select count(*) as visible_refunds
from public.refunds r
join public.orders o on o.id = r.order_id
where o.restaurant_id = '<restaurant-uuid>';
rollback;

-- (o) No delete policy: deleting a refund removes zero rows.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
delete from public.refunds
where id = '<refund-uuid>'
returning id;
rollback;

-- ---------------------------------------------------------------------
-- M7 — staff directory and add-by-email
-- ---------------------------------------------------------------------

-- (p) Staff can read the directory (including inactive rows). Expected: rows.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select * from public.list_staff_directory('<restaurant-uuid>');
rollback;

-- (q) A non-staff caller gets zero directory rows.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<non-staff-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select count(*) as should_be_zero
from public.list_staff_directory('<restaurant-uuid>');
rollback;

-- (r) Kitchen staff cannot add members. Expected: ERROR 42501.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<kitchen-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select public.add_staff_by_email('<restaurant-uuid>', 'someone@example.test', 'manager');
rollback;

-- (s) Unknown email returns P0002. Expected: ERROR with the sign-up message.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select public.add_staff_by_email('<restaurant-uuid>', 'nobody@example.test', 'manager');
rollback;

-- ---------------------------------------------------------------------
-- M8 / Phase 5 — guest placement + tracking (0015)
-- ---------------------------------------------------------------------
-- Fully self-contained: NO placeholders to substitute. Each check runs in
-- its own transaction and ROLLS BACK, creating throwaway fixtures as
-- needed (tables with 'rls-test-*' qr_tokens, a 'rls-test-other'
-- restaurant with fixed 'fa11…' uuids). Nothing is written permanently.
--
-- Requirements: migration 0015 applied; seed data present (at least one
-- active restaurant with one available menu item, and one profile row to
-- own the throwaway fixture restaurant).
--
-- Run top to bottom in the SQL Editor and confirm:
--   (t)  all five grant columns are true
--   (u)  NOTICE  phase5 place_order ok (token=…, total=…)
--   (v)  NOTICE  phase5 inactive table rejected ok
--   (w)  NOTICE  phase5 cross-restaurant item rejected ok
--   (x)  NOTICE  phase5 empty cart rejected ok
--   (y)  NOTICE  phase5 resolve_qr_context table_inactive ok
--   (z)  NOTICE  phase5 resolve_qr_context table_not_found ok
--   (aa) visible_orders = 0

-- (t) Function grants. Expected: all five columns true.
select
  has_function_privilege(
    'anon', 'public.place_order(text,text,text,text,jsonb)', 'execute'
  ) as anon_can_place_order,
  has_function_privilege(
    'authenticated', 'public.place_order(text,text,text,text,jsonb)', 'execute'
  ) as authenticated_can_place_order,
  has_function_privilege(
    'anon', 'public.get_order_tracking(text)', 'execute'
  ) as anon_can_track,
  has_function_privilege(
    'authenticated', 'public.get_order_tracking(text)', 'execute'
  ) as authenticated_can_track,
  has_function_privilege(
    'anon', 'public.resolve_qr_context(text,text)', 'execute'
  ) as anon_can_resolve_qr;

-- (u) Guest place_order + tracking happy path, tampered price ignored.
-- Rolls back; no order survives.
begin;

-- Fixture: an active table with a known qr_token on the first active restaurant.
insert into public.tables (restaurant_id, table_number, qr_token, location_label, is_active)
select id, 'RLS-TEST-ACT', 'rls-test-active-token', 'RLS fixture', true
  from public.restaurants
 where is_active
 order by created_at
 limit 1;

select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;

do $$
declare
  v_restaurant_id  uuid;
  v_slug           text;
  v_item_id        uuid;
  v_expected_price numeric;
  v_placed         jsonb;
  v_tracked        jsonb;
  v_token          text;
  v_items          int;
begin
  select r.id, r.slug
    into v_restaurant_id, v_slug
    from public.restaurants r
   where r.is_active
   order by r.created_at
   limit 1;
  if v_slug is null then
    raise exception 'no active restaurant found; run seed.sql first';
  end if;

  select m.id, m.price
    into v_item_id, v_expected_price
    from public.menu_items m
   where m.restaurant_id = v_restaurant_id
     and m.is_available
   order by m.created_at
   limit 1;
  if v_item_id is null then
    raise exception 'no available menu item for %; seed a menu first', v_slug;
  end if;

  -- A tampered client price in the payload must be ignored.
  v_placed := public.place_order(
    v_slug,
    'rls-test-active-token',
    'RLS Phase 5 Guest',
    'Window seat please',
    jsonb_build_array(
      jsonb_build_object(
        'menu_item_id', v_item_id,
        'quantity', 2,
        'unit_price', 0.01
      )
    )
  );

  if v_placed->>'status' <> 'confirmed' then
    raise exception 'expected status confirmed, got %', v_placed->>'status';
  end if;

  if (v_placed->>'total')::numeric <> round(v_expected_price * 2, 2) then
    raise exception 'server total % did not equal menu price x 2 %',
      v_placed->>'total', round(v_expected_price * 2, 2);
  end if;

  if (v_placed->>'subtotal')::numeric + (v_placed->>'tax')::numeric
     <> (v_placed->>'total')::numeric then
    raise exception 'GST-inclusive split did not reconcile';
  end if;

  v_token := v_placed->>'tracking_token';
  if v_token is null or length(v_token) = 0 then
    raise exception 'place_order did not return a tracking token';
  end if;

  v_tracked := public.get_order_tracking(v_token);
  if v_tracked is null then
    raise exception 'get_order_tracking returned null for a valid token';
  end if;

  v_items := jsonb_array_length(v_tracked->'items');
  if v_items <> 1 then
    raise exception 'expected 1 tracking line item, got %', v_items;
  end if;

  if (v_tracked->>'total')::numeric <> (v_placed->>'total')::numeric then
    raise exception 'tracking total did not match the placed total';
  end if;

  if public.get_order_tracking('definitely-not-a-token') is not null then
    raise exception 'invalid tracking token must return null';
  end if;

  -- Anon must not be able to read orders directly.
  if (select count(*) from public.orders) <> 0 then
    raise exception 'anon could read orders rows';
  end if;

  raise notice 'phase5 place_order ok (token=%, total=%)',
    left(v_token, 8) || '…', v_placed->>'total';
end $$;
rollback;

-- (v) Guest cannot place an order with a deactivated table.
-- Expected: NOTICE phase5 inactive table rejected ok (place_order raises
-- table_not_found and nothing is written).
begin;

insert into public.tables (restaurant_id, table_number, qr_token, location_label, is_active)
select id, 'RLS-TEST-INACT', 'rls-test-inactive-token', 'RLS fixture', false
  from public.restaurants
 where is_active
 order by created_at
 limit 1;

select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;

do $$
declare
  v_slug    text;
  v_item_id uuid;
  v_placed  jsonb;
begin
  select r.slug
    into v_slug
    from public.restaurants r
   where r.is_active
   order by r.created_at
   limit 1;

  select m.id
    into v_item_id
    from public.menu_items m
   where m.restaurant_id = (select id from public.restaurants where slug = v_slug)
     and m.is_available
   order by m.created_at
   limit 1;

  begin
    v_placed := public.place_order(
      v_slug,
      'rls-test-inactive-token',
      'RLS Deactivated Table',
      null,
      jsonb_build_array(
        jsonb_build_object('menu_item_id', v_item_id, 'quantity', 1)
      )
    );
    raise exception 'expected table_not_found, but order % was placed',
      v_placed->>'order_number';
  exception when sqlstate 'P0001' then
    if position('table_not_found' in sqlerrm) = 0 then
      raise;
    end if;
    raise notice 'phase5 inactive table rejected ok';
  end;
end $$;
rollback;

-- (w) Cross-restaurant menu items are rejected and nothing is written.
-- Expected: NOTICE phase5 cross-restaurant item rejected ok.
begin;

-- Fixtures: a throwaway second restaurant owning one menu item.
insert into public.restaurants (id, owner_id, slug, name, is_active)
select 'fa110000-0000-4000-8000-000000000001', p.id, 'rls-test-other', 'RLS Other Restaurant', true
  from public.profiles p
 limit 1;

insert into public.menu_categories (id, restaurant_id, name)
values ('fa110000-0000-4000-8000-000000000002', 'fa110000-0000-4000-8000-000000000001', 'RLS Test');

insert into public.menu_items (id, restaurant_id, category_id, name, price)
values ('fa110000-0000-4000-8000-000000000003', 'fa110000-0000-4000-8000-000000000001', 'fa110000-0000-4000-8000-000000000002', 'RLS Test Item', 9.90);

insert into public.tables (restaurant_id, table_number, qr_token, location_label, is_active)
select id, 'RLS-TEST-ACT', 'rls-test-active-token', 'RLS fixture', true
  from public.restaurants
 where is_active and slug <> 'rls-test-other'
 order by created_at
 limit 1;

select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;

do $$
declare
  v_slug   text;
  v_placed jsonb;
begin
  select r.slug
    into v_slug
    from public.restaurants r
   where r.is_active and r.slug <> 'rls-test-other'
   order by r.created_at
   limit 1;

  begin
    v_placed := public.place_order(
      v_slug,
      'rls-test-active-token',
      'RLS Cross Restaurant',
      null,
      jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', 'fa110000-0000-4000-8000-000000000003',
          'quantity', 1
        )
      )
    );
    raise exception 'expected menu_item_unavailable, but order % was placed',
      v_placed->>'order_number';
  exception when sqlstate 'P0001' then
    if position('menu_item_unavailable' in sqlerrm) = 0 then
      raise;
    end if;
    raise notice 'phase5 cross-restaurant item rejected ok';
  end;
end $$;
rollback;

-- (x) An empty cart is rejected before anything else is looked at.
-- Expected: NOTICE phase5 empty cart rejected ok.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;

do $$
declare
  v_placed jsonb;
begin
  begin
    v_placed := public.place_order(
      'any-slug', 'any-token', 'RLS Empty Cart', null, '[]'::jsonb
    );
    raise exception 'expected empty_cart, but order % was placed',
      v_placed->>'order_number';
  exception when sqlstate 'P0001' then
    if position('empty_cart' in sqlerrm) = 0 then
      raise;
    end if;
    raise notice 'phase5 empty cart rejected ok';
  end;
end $$;
rollback;

-- (y) resolve_qr_context distinguishes a deactivated table.
-- Expected: NOTICE phase5 resolve_qr_context table_inactive ok.
begin;

insert into public.tables (restaurant_id, table_number, qr_token, location_label, is_active)
select id, 'RLS-TEST-INACT', 'rls-test-inactive-token', 'RLS fixture', false
  from public.restaurants
 where is_active
 order by created_at
 limit 1;

select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;

do $$
declare
  v_slug text;
  v_out  jsonb;
begin
  select r.slug
    into v_slug
    from public.restaurants r
   where r.is_active
   order by r.created_at
   limit 1;

  v_out := public.resolve_qr_context(v_slug, 'rls-test-inactive-token');
  if v_out->>'error' is distinct from 'table_inactive' then
    raise exception 'expected table_inactive, got %', v_out;
  end if;
  raise notice 'phase5 resolve_qr_context table_inactive ok';
end $$;
rollback;

-- (z) A wrong-restaurant table token is rejected by the resolver.
-- Expected: NOTICE phase5 resolve_qr_context table_not_found ok.
begin;

insert into public.restaurants (id, owner_id, slug, name, is_active)
select 'fa110000-0000-4000-8000-000000000001', p.id, 'rls-test-other', 'RLS Other Restaurant', true
  from public.profiles p
 limit 1;

insert into public.tables (restaurant_id, table_number, qr_token, location_label, is_active)
values ('fa110000-0000-4000-8000-000000000001', 'RLS-TEST-OTHER', 'rls-test-other-token', 'RLS fixture', true);

select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;

do $$
declare
  v_slug text;
  v_out  jsonb;
begin
  select r.slug
    into v_slug
    from public.restaurants r
   where r.is_active and r.slug <> 'rls-test-other'
   order by r.created_at
   limit 1;

  v_out := public.resolve_qr_context(v_slug, 'rls-test-other-token');
  if v_out->>'error' is distinct from 'table_not_found' then
    raise exception 'expected table_not_found, got %', v_out;
  end if;
  raise notice 'phase5 resolve_qr_context table_not_found ok';
end $$;
rollback;

-- (aa) Orders RLS is unchanged: anon still cannot select arbitrary rows.
-- Expected: visible_orders = 0.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
select count(*) as visible_orders from public.orders;
rollback;
