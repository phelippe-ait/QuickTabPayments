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

-- =====================================================================
-- Phase 6 — payments (manual checks)
-- =====================================================================
-- Payment write RPCs must be service_role-only. Expected: anon=false,
-- authenticated=false, service_role=true for each.
select
  has_function_privilege(
    'anon',
    'public.record_payment_intent(uuid,numeric,text,text,text)',
    'EXECUTE'
  ) as anon_can_record_payment,
  has_function_privilege(
    'authenticated',
    'public.record_payment_intent(uuid,numeric,text,text,text)',
    'EXECUTE'
  ) as auth_can_record_payment,
  has_function_privilege(
    'service_role',
    'public.record_payment_intent(uuid,numeric,text,text,text)',
    'EXECUTE'
  ) as service_can_record_payment,
  has_function_privilege(
    'anon',
    'public.apply_payment_succeeded(text,text,text)',
    'EXECUTE'
  ) as anon_can_apply_payment,
  has_function_privilege(
    'service_role',
    'public.apply_payment_succeeded(text,text,text)',
    'EXECUTE'
  ) as service_can_apply_payment;

-- 0018 lockdown: the remaining two payment RPCs. Same expectation —
-- anon=false, authenticated=false, service_role=true. (On Supabase,
-- `revoke ... from public` alone does NOT remove the default-privilege
-- grants to anon/authenticated; 0018 revokes from all three explicitly.)
select
  has_function_privilege(
    'anon',
    'public.apply_payment_failed(text,text)',
    'EXECUTE'
  ) as anon_can_fail_payment,
  has_function_privilege(
    'authenticated',
    'public.apply_payment_failed(text,text)',
    'EXECUTE'
  ) as auth_can_fail_payment,
  has_function_privilege(
    'service_role',
    'public.apply_payment_failed(text,text)',
    'EXECUTE'
  ) as service_can_fail_payment,
  has_function_privilege(
    'anon',
    'public.apply_refund_succeeded(text,text,numeric,boolean)',
    'EXECUTE'
  ) as anon_can_apply_refund,
  has_function_privilege(
    'authenticated',
    'public.apply_refund_succeeded(text,text,numeric,boolean)',
    'EXECUTE'
  ) as auth_can_apply_refund,
  has_function_privilege(
    'service_role',
    'public.apply_refund_succeeded(text,text,numeric,boolean)',
    'EXECUTE'
  ) as service_can_apply_refund;

-- place_order now creates `pending` orders. Place a real order as anon and
-- assert the returned status; the rollback discards the fixture.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;

do $$
declare
  v_slug  text;
  v_token text;
  v_item  uuid;
  v_out   jsonb;
begin
  select r.slug into v_slug
    from public.restaurants r
   where r.is_active and r.slug <> 'rls-test-other'
   order by r.created_at limit 1;

  select t.qr_token into v_token
    from public.tables t
    join public.restaurants r on r.id = t.restaurant_id
   where r.slug = v_slug and t.is_active
   order by t.table_number limit 1;

  select mi.id into v_item
    from public.menu_items mi
    join public.restaurants r on r.id = mi.restaurant_id
   where r.slug = v_slug and mi.is_available
   limit 1;

  if v_slug is null or v_token is null or v_item is null then
    raise notice 'phase6 place_order check skipped (no demo data)';
    return;
  end if;

  v_out := public.place_order(
    v_slug,
    v_token,
    'RLS payment check',
    null,
    jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_item,
      'quantity', 1
    ))
  );

  if v_out->>'status' is distinct from 'pending' then
    raise exception 'expected pending order, got %', v_out->>'status';
  end if;
  raise notice 'phase6 place_order creates pending orders ok';
end $$;
rollback;

-- Phase 7 — guest order claiming. Only signed-in users may claim.
-- Expected: anon=false, authenticated=true.
select
  has_function_privilege(
    'anon',
    'public.claim_guest_order(text)',
    'EXECUTE'
  ) as anon_can_claim_guest_order,
  has_function_privilege(
    'authenticated',
    'public.claim_guest_order(text)',
    'EXECUTE'
  ) as auth_can_claim_guest_order;

-- ---------------------------------------------------------------------
-- P01 — subscription plan column (0020)
-- ---------------------------------------------------------------------
-- `plan` has no column-level policy: Postgres has no column-level RLS, and
-- it is covered by the existing `restaurants` row policies. These checks
-- document that reads keep working for anon/customers while cross-tenant
-- writes stay blocked.
--
-- <restaurant-slug>       demo restaurant slug (e.g. quicktab-demo-cafe)
-- <customer-user-uuid>    a signed-in user with no staff role
-- <manager-user-uuid>     an active manager of the demo restaurant
-- <other-restaurant-uuid> a different restaurant's id

-- (ab) Anonymous customers can read the plan of an active restaurant.
-- Expected: one row with plan = basic/standard/premium.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
select slug, plan
from public.restaurants
where slug = '<restaurant-slug>';
rollback;

-- (ac) A signed-in customer (not staff) can read the plan as well.
-- Expected: one row with plan = basic/standard/premium.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<customer-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select slug, plan
from public.restaurants
where slug = '<restaurant-slug>';
rollback;

-- (ad) A manager of restaurant A cannot change restaurant B's plan.
-- Expected: UPDATE 0 (the row is invisible under `restaurants_staff_update`).
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
update public.restaurants
   set plan = 'premium'
 where id = '<other-restaurant-uuid>';
rollback;

-- ---------------------------------------------------------------------
-- P02 — sales reporting RPC (0021)
-- ---------------------------------------------------------------------
-- get_sales_report() resolves the restaurant from the caller's active
-- restaurant_staff row (owner|manager) and rejects everyone else. The
-- report is aggregated server-side, so these checks only need to prove
-- the caller gate and restaurant scoping.
--
-- <restaurant-uuid>        demo restaurant A id
-- <restaurant-slug>        demo restaurant A slug
-- <manager-user-uuid>      active manager of A
-- <kitchen-user-uuid>      active kitchen staff of A
-- <customer-user-uuid>     signed-in user with no staff role
-- <other-staff-user-uuid>  owner/manager of a different restaurant B

-- Execute privilege: anon=false, authenticated=true.
select
  has_function_privilege(
    'anon',
    'public.get_sales_report(timestamptz,timestamptz)',
    'EXECUTE'
  ) as anon_can_get_sales_report,
  has_function_privilege(
    'authenticated',
    'public.get_sales_report(timestamptz,timestamptz)',
    'EXECUTE'
  ) as auth_can_get_sales_report;

-- (ae) A manager of A gets a report scoped to A.
-- Expected: NOTICE P02 get_sales_report manager scope ok.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
do $$
declare
  v_out      jsonb;
  v_expected numeric;
  v_top      jsonb;
  v_hours    jsonb;
begin
  v_out := public.get_sales_report(now() - interval '7 days', now());

  if v_out->>'currency' is null
     or v_out->>'from' is null
     or v_out->>'to' is null then
    raise exception 'report is missing header fields: %', v_out;
  end if;

  -- Money is text with exactly 2 decimals.
  if (v_out->>'gross_revenue')     !~ '^-?[0-9]+\.[0-9]{2}$'
     or (v_out->>'paid_revenue')   !~ '^-?[0-9]+\.[0-9]{2}$'
     or (v_out->>'refunded_amount') !~ '^-?[0-9]+\.[0-9]{2}$'
     or (v_out->>'aov')            !~ '^-?[0-9]+\.[0-9]{2}$' then
    raise exception 'report money is not 2-dp text: %', v_out;
  end if;

  -- Exactly 24 zero-filled hours.
  v_hours := v_out->'busy_hours';
  if jsonb_typeof(v_hours) <> 'array' or jsonb_array_length(v_hours) <> 24 then
    raise exception 'busy_hours is not 24 entries: %', v_hours;
  end if;

  if jsonb_typeof(v_out->'top_items') <> 'array' then
    raise exception 'top_items is not an array: %', v_out->'top_items';
  end if;

  -- Manager is staff of A, so RLS lets the comparison query see A's orders.
  select round(coalesce(sum(o.total), 0), 2)
    into v_expected
  from public.orders o
  where o.restaurant_id = '<restaurant-uuid>'
    and o.created_at >= now() - interval '7 days'
    and o.created_at <  now()
    and o.status <> 'cancelled';

  if (v_out->>'gross_revenue')::numeric is distinct from v_expected then
    raise exception 'gross_revenue % <> direct aggregate %',
      v_out->>'gross_revenue', v_expected;
  end if;

  raise notice 'P02 get_sales_report manager scope ok';
end $$;
rollback;

-- (af) Kitchen staff of A are rejected.
-- Expected: NOTICE P02 get_sales_report kitchen not_authorised ok.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<kitchen-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
do $$
declare
  v_err text;
begin
  begin
    perform public.get_sales_report(now() - interval '7 days', now());
    raise exception 'expected not_authorised for kitchen';
  exception
    when others then
      v_err := sqlerrm;
  end;

  if v_err is distinct from 'not_authorised' then
    raise exception 'expected not_authorised, got %', v_err;
  end if;
  raise notice 'P02 get_sales_report kitchen not_authorised ok';
end $$;
rollback;

-- (ag) A signed-in customer (no staff row) is rejected.
-- Expected: NOTICE P02 get_sales_report customer not_authorised ok.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<customer-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
do $$
declare
  v_err text;
begin
  begin
    perform public.get_sales_report(now() - interval '7 days', now());
    raise exception 'expected not_authorised for customer';
  exception
    when others then
      v_err := sqlerrm;
  end;

  if v_err is distinct from 'not_authorised' then
    raise exception 'expected not_authorised, got %', v_err;
  end if;
  raise notice 'P02 get_sales_report customer not_authorised ok';
end $$;
rollback;

-- (ah) Owner/manager of a different restaurant B is rejected.
-- Expected: NOTICE P02 get_sales_report other restaurant not_authorised ok.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<other-staff-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
do $$
declare
  v_err text;
begin
  begin
    perform public.get_sales_report(now() - interval '7 days', now());
    raise exception 'expected not_authorised for other restaurant staff';
  exception
    when others then
      v_err := sqlerrm;
  end;

  if v_err is distinct from 'not_authorised' then
    raise exception 'expected not_authorised, got %', v_err;
  end if;
  raise notice 'P02 get_sales_report other restaurant not_authorised ok';
end $$;
rollback;

-- (ai) Cross-restaurant leakage (manual procedure, seeds nothing here).
-- The function scopes every aggregate to the resolved restaurant id, so
-- restaurant B's orders can never appear in A's report. To verify by hand:
--   1. As manager of A, record the report for a known window:
--        select public.get_sales_report(now() - interval '1 day', now());
--   2. In a scratch transaction (rolled back afterwards), insert an order
--      for restaurant B with a distinctive total:
--        insert into public.orders (restaurant_id, order_number, status, total)
--        values ('<other-restaurant-uuid>', 'RLS-B-LEAK', 'confirmed', 999.99);
--   3. Call get_sales_report again for A in the same window and compare:
--      currency, from, to, order_count, gross_revenue, paid_revenue,
--      refunded_amount, aov, top_items and busy_hours must be identical.
--   4. rollback;

-- =====================================================================
-- P03 — order status transition guard (0022)
-- =====================================================================
-- <restaurant-uuid> and <manager-user-uuid> as above. Each check inserts a
-- scratch order inside a transaction and rolls it back.

-- (aj) Staff cannot skip pending -> ready. Expected: NOTICE
--      "P03 illegal status transition rejected ok".
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
insert into public.orders (restaurant_id, order_number, status)
values ('<restaurant-uuid>', 'RLS-P03-ILLEGAL', 'pending');
do $$
declare
  v_err text;
begin
  begin
    update public.orders
       set status = 'ready'
     where restaurant_id = '<restaurant-uuid>'
       and order_number = 'RLS-P03-ILLEGAL';
    raise exception 'expected invalid_status_transition';
  exception
    when others then
      v_err := sqlerrm;
  end;

  if v_err is distinct from 'invalid_status_transition' then
    raise exception 'expected invalid_status_transition, got %', v_err;
  end if;
  raise notice 'P03 illegal status transition rejected ok';
end $$;
rollback;

-- (ak) The legal pending -> confirmed transition is allowed, the rest of the
--      matrix can be walked, and completing the order stamps completed_at.
--      Expected: NOTICE "P03 legal status transition allowed ok".
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<manager-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
insert into public.orders (restaurant_id, order_number, status)
values ('<restaurant-uuid>', 'RLS-P03-LEGAL', 'pending');
update public.orders
   set status = 'confirmed'
 where restaurant_id = '<restaurant-uuid>'
   and order_number = 'RLS-P03-LEGAL';
do $$
declare
  v_completed_at timestamptz;
begin
  update public.orders
     set status = 'preparing'
   where restaurant_id = '<restaurant-uuid>'
     and order_number = 'RLS-P03-LEGAL'
     and status = 'confirmed';
  update public.orders
     set status = 'ready'
   where restaurant_id = '<restaurant-uuid>'
     and order_number = 'RLS-P03-LEGAL'
     and status = 'preparing';
  update public.orders
     set status = 'completed'
   where restaurant_id = '<restaurant-uuid>'
     and order_number = 'RLS-P03-LEGAL'
     and status = 'ready';

  select completed_at into v_completed_at
    from public.orders
   where restaurant_id = '<restaurant-uuid>'
     and order_number = 'RLS-P03-LEGAL';

  if v_completed_at is null then
    raise exception 'expected completed_at to be set on completion';
  end if;
  raise notice 'P03 legal status transition allowed ok';
end $$;
rollback;

-- ---------------------------------------------------------------------
-- P04 — tips
-- ---------------------------------------------------------------------
-- <restaurant-slug>  demo restaurant slug (e.g. quicktab-demo-cafe)
-- <table-token>      an active table's qr_token for <restaurant-uuid>
-- <menu-item-uuid>   an available menu item for <restaurant-uuid>
-- <customer-user-uuid> signed-in customer's auth user id

-- (al) Anon places an order with a 10% tip. Expected: NOTICE
--      "P04 percent tip computed ok".
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
do $$
declare
  v_result     jsonb;
  v_total      numeric;
  v_tip        numeric;
  v_amount_due numeric;
  v_expected   numeric;
begin
  v_result := public.place_order(
    '<restaurant-slug>',
    '<table-token>',
    'RLS P04 Tip',
    null,
    jsonb_build_array(
      jsonb_build_object('menu_item_id', '<menu-item-uuid>', 'quantity', 1)
    ),
    null,
    null,
    jsonb_build_object('type', 'percent', 'value', 10)
  );

  v_total      := (v_result->>'total')::numeric;
  v_tip        := (v_result->>'tip_amount')::numeric;
  v_amount_due := (v_result->>'amount_due')::numeric;
  v_expected   := round(v_total * 10 / 100, 2);

  if v_tip is distinct from v_expected then
    raise exception 'expected tip %, got %', v_expected, v_tip;
  end if;

  if v_amount_due is distinct from round(v_total + v_tip, 2) then
    raise exception 'expected amount_due %, got %', round(v_total + v_tip, 2), v_amount_due;
  end if;

  raise notice 'P04 percent tip computed ok';
end $$;
rollback;

-- (am) Tampered tips are rejected by the RPC. Expected: NOTICE
--      "P04 invalid tips rejected ok".
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
do $$
declare
  v_err text;
begin
  begin
    perform public.place_order(
      '<restaurant-slug>',
      '<table-token>',
      'RLS P04 Bad Tip',
      null,
      jsonb_build_array(
        jsonb_build_object('menu_item_id', '<menu-item-uuid>', 'quantity', 1)
      ),
      null,
      null,
      jsonb_build_object('type', 'percent', 'value', -5)
    );
    raise exception 'expected invalid_tip';
  exception
    when others then
      v_err := sqlerrm;
  end;

  if v_err is distinct from 'invalid_tip' then
    raise exception 'expected invalid_tip, got %', v_err;
  end if;

  begin
    perform public.place_order(
      '<restaurant-slug>',
      '<table-token>',
      'RLS P04 Bad Tip',
      null,
      jsonb_build_array(
        jsonb_build_object('menu_item_id', '<menu-item-uuid>', 'quantity', 1)
      ),
      null,
      null,
      jsonb_build_object('type', 'fixed', 'value', 999)
    );
    raise exception 'expected invalid_tip';
  exception
    when others then
      v_err := sqlerrm;
  end;

  if v_err is distinct from 'invalid_tip' then
    raise exception 'expected invalid_tip, got %', v_err;
  end if;

  raise notice 'P04 invalid tips rejected ok';
end $$;
rollback;

-- (an) A customer cannot update orders.tip_amount directly. Expected: NOTICE
--      "P04 customer cannot update tip_amount ok".
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<customer-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
do $$
declare
  v_result  jsonb;
  v_order_id uuid;
  v_updated int;
begin
  v_result := public.place_order(
    '<restaurant-slug>',
    '<table-token>',
    'RLS P04 Customer Tip',
    null,
    jsonb_build_array(
      jsonb_build_object('menu_item_id', '<menu-item-uuid>', 'quantity', 1)
    ),
    null,
    null,
    jsonb_build_object('type', 'fixed', 'value', 1)
  );

  v_order_id := (v_result->>'order_id')::uuid;

  update public.orders
     set tip_amount = 99.99
   where id = v_order_id;
  get diagnostics v_updated = row_count;

  if v_updated <> 0 then
    raise exception 'customer updated tip_amount directly';
  end if;

  raise notice 'P04 customer cannot update tip_amount ok';
end $$;
rollback;

-- ---------------------------------------------------------------------
-- P05 — modifier validation + pricing inside place_order
-- ---------------------------------------------------------------------
-- <restaurant-uuid>    demo restaurant id
-- <restaurant-slug>    demo restaurant slug (e.g. quicktab-demo-cafe)
-- <table-token>        an active table's qr_token for <restaurant-uuid>
-- <menu-item-uuid>     an available menu item for <restaurant-uuid> that has
--                      at least one modifier group linked to it

-- (ao) A valid modifier set is priced from live DB values, folded into one
--      line and snapshotted. Extra pricing hints in the payload are ignored.
--      Expected: NOTICE "P05 valid modifiers priced + snapshotted ok".
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
do $$
declare
  v_ids             jsonb;
  v_base            numeric;
  v_adjustment      numeric;
  v_expected_price  numeric;
  v_result          jsonb;
  v_tracking        jsonb;
  v_expected_count  int;
begin
  -- Pick the minimum required modifiers from each linked group (one from
  -- each required/minimum group, respecting single-selection limits).
  select coalesce(jsonb_agg(chosen.id order by chosen.group_id, chosen.display_order), '[]'::jsonb)
    into v_ids
  from (
    select
      m.id,
      g.id as group_id,
      m.display_order,
      row_number() over (partition by g.id order by m.display_order, m.name) as rn,
      greatest(g.min_selections, case when g.is_required then 1 else 0 end) as need
    from public.menu_item_modifier_groups img
    join public.modifier_groups g on g.id = img.modifier_group_id
    join public.modifiers m
      on m.modifier_group_id = g.id
     and m.is_available
    where img.menu_item_id = '<menu-item-uuid>'
  ) as chosen
  where chosen.rn <= chosen.need;

  select mi.price
    into v_base
  from public.menu_items mi
  where mi.id = '<menu-item-uuid>';

  select coalesce(sum(m.price_adjustment), 0)
    into v_adjustment
  from jsonb_array_elements_text(v_ids) as selected(value)
  join public.modifiers m on m.id = selected.value::uuid;

  v_expected_price := round(v_base + v_adjustment, 2);
  v_expected_count := jsonb_array_length(v_ids);

  v_result := public.place_order(
    '<restaurant-slug>',
    '<table-token>',
    'RLS P05 Modifiers',
    null,
    jsonb_build_array(
      jsonb_build_object(
        'menu_item_id', '<menu-item-uuid>',
        'quantity', 1,
        'modifiers', v_ids,
        -- Tampered pricing hints: the server must ignore these and read the
        -- live menu/modifier values instead.
        'unit_price', 0.01,
        'price_adjustment', 9999
      )
    )
  );

  if (v_result->'items'->0->>'unit_price')::numeric is distinct from v_expected_price then
    raise exception 'expected unit_price %, got %',
      v_expected_price, v_result->'items'->0->>'unit_price';
  end if;

  -- get_order_tracking is security definer and returns the snapshots that
  -- were written to order_item_modifiers.
  v_tracking := public.get_order_tracking(v_result->>'tracking_token');

  if jsonb_array_length(v_tracking->'items'->0->'modifiers') <> v_expected_count then
    raise exception 'expected % modifier snapshots, got %',
      v_expected_count, jsonb_array_length(v_tracking->'items'->0->'modifiers');
  end if;

  raise notice 'P05 valid modifiers priced + snapshotted ok';
end $$;
rollback;

-- (ap) A modifier that belongs to another restaurant's item is rejected. A
--      throwaway second restaurant is created inside the transaction and
--      rolled back with it. Expected: NOTICE
--      "P05 foreign modifier rejected ok".
begin;
do $$
declare
  v_owner   uuid;
  v_foreign_restaurant uuid;
  v_group   uuid;
  v_modifier uuid;
begin
  select id into v_owner from public.profiles limit 1;

  if v_owner is null then
    raise notice 'P05 foreign modifier check skipped (no profiles)';
    return;
  end if;

  insert into public.restaurants (owner_id, slug, name, is_active)
  values (
    v_owner,
    'rls-p05-foreign-' || gen_random_uuid(),
    'RLS P05 Foreign Restaurant',
    true
  )
  returning id into v_foreign_restaurant;

  insert into public.modifier_groups (
    restaurant_id, name, selection_type, min_selections, max_selections,
    is_required, display_order
  )
  values (v_foreign_restaurant, 'Foreign extras', 'multiple', 0, 5, false, 0)
  returning id into v_group;

  insert into public.modifiers (modifier_group_id, name, price_adjustment)
  values (v_group, 'Foreign choice', 1.00)
  returning id into v_modifier;

  create temp table p05_foreign_fixture as select v_modifier as modifier_id;
  grant select on p05_foreign_fixture to anon;
end $$;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
do $$
declare
  v_foreign uuid;
  v_err     text;
begin
  select modifier_id into v_foreign from p05_foreign_fixture;

  if v_foreign is null then
    raise notice 'P05 foreign modifier check skipped (no fixture)';
    return;
  end if;

  begin
    perform public.place_order(
      '<restaurant-slug>',
      '<table-token>',
      'RLS P05 Foreign',
      null,
      jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', '<menu-item-uuid>',
          'quantity', 1,
          'modifiers', jsonb_build_array(v_foreign)
        )
      )
    );
    raise exception 'expected invalid_modifier';
  exception
    when others then
      v_err := sqlerrm;
  end;

  if v_err is distinct from 'invalid_modifier' then
    raise exception 'expected invalid_modifier, got %', v_err;
  end if;

  raise notice 'P05 foreign modifier rejected ok';
end $$;
rollback;

-- (aq) Exceeding a multiple group's max_selections is rejected. A temporary
--      max-2 group with three modifiers is created inside the transaction and
--      rolled back with it. Expected: NOTICE
--      "P05 max selections rejected ok".
begin;
do $$
declare
  v_group uuid;
begin
  insert into public.modifier_groups (
    restaurant_id, name, selection_type, min_selections, max_selections,
    is_required, display_order
  )
  values (
    '<restaurant-uuid>', 'RLS P05 Max', 'multiple', 0, 2, false, 9999
  )
  returning id into v_group;

  insert into public.menu_item_modifier_groups (menu_item_id, modifier_group_id)
  values ('<menu-item-uuid>', v_group);

  insert into public.modifiers (modifier_group_id, name, price_adjustment, display_order)
  values
    (v_group, 'Max A', 0, 0),
    (v_group, 'Max B', 0, 1),
    (v_group, 'Max C', 0, 2);

  create temp table p05_max_fixture as
    select jsonb_agg(id order by display_order) as modifier_ids
    from public.modifiers
    where modifier_group_id = v_group;

  grant select on p05_max_fixture to anon;
end $$;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
do $$
declare
  v_ids jsonb;
  v_err text;
begin
  select modifier_ids into v_ids from p05_max_fixture;

  begin
    perform public.place_order(
      '<restaurant-slug>',
      '<table-token>',
      'RLS P05 Max',
      null,
      jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', '<menu-item-uuid>',
          'quantity', 1,
          'modifiers', v_ids
        )
      )
    );
    raise exception 'expected modifier_selection_invalid';
  exception
    when others then
      v_err := sqlerrm;
  end;

  if v_err is distinct from 'modifier_selection_invalid' then
    raise exception 'expected modifier_selection_invalid, got %', v_err;
  end if;

  raise notice 'P05 max selections rejected ok';
end $$;
rollback;

-- (ar) Skipping a required group is rejected. A temporary required group is
--      created inside the transaction and rolled back with it. Expected:
--      NOTICE "P05 required group enforced ok".
begin;
do $$
declare
  v_group uuid;
begin
  insert into public.modifier_groups (
    restaurant_id, name, selection_type, min_selections, max_selections,
    is_required, display_order
  )
  values (
    '<restaurant-uuid>', 'RLS P05 Required', 'single', 0, 1, true, 10000
  )
  returning id into v_group;

  insert into public.menu_item_modifier_groups (menu_item_id, modifier_group_id)
  values ('<menu-item-uuid>', v_group);

  insert into public.modifiers (modifier_group_id, name, price_adjustment, display_order)
  values (v_group, 'Required choice', 0, 0);
end $$;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
do $$
declare
  v_err text;
begin
  begin
    perform public.place_order(
      '<restaurant-slug>',
      '<table-token>',
      'RLS P05 Required',
      null,
      jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', '<menu-item-uuid>',
          'quantity', 1,
          'modifiers', '[]'::jsonb
        )
      )
    );
    raise exception 'expected modifier_required';
  exception
    when others then
      v_err := sqlerrm;
  end;

  if v_err is distinct from 'modifier_required' then
    raise exception 'expected modifier_required, got %', v_err;
  end if;

  raise notice 'P05 required group enforced ok';
end $$;
rollback;

-- (as) Identical item + modifier lines fold into one order line while a
--      different modifier selection stays separate. Expected: NOTICE
--      "P05 identical lines fold ok".
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
do $$
declare
  v_a       uuid;
  v_b       uuid;
  v_result  jsonb;
begin
  -- Two available modifiers from the same optional group: one variant each.
  select m.id
    into v_a
  from public.menu_item_modifier_groups img
  join public.modifiers m on m.modifier_group_id = img.modifier_group_id and m.is_available
  where img.menu_item_id = '<menu-item-uuid>'
  order by m.display_order, m.name
  limit 1;

  if v_a is null then
    raise notice 'P05 folding check skipped (item has no available modifiers)';
    return;
  end if;

  v_result := public.place_order(
    '<restaurant-slug>',
    '<table-token>',
    'RLS P05 Fold',
    null,
    jsonb_build_array(
      jsonb_build_object('menu_item_id', '<menu-item-uuid>', 'quantity', 1, 'modifiers', jsonb_build_array(v_a)),
      jsonb_build_object('menu_item_id', '<menu-item-uuid>', 'quantity', 1, 'modifiers', jsonb_build_array(v_a)),
      jsonb_build_object('menu_item_id', '<menu-item-uuid>', 'quantity', 1, 'modifiers', '[]'::jsonb)
    )
  );

  if jsonb_array_length(v_result->'items') <> 2 then
    raise exception 'expected 2 folded lines, got %', jsonb_array_length(v_result->'items');
  end if;

  raise notice 'P05 identical lines fold ok';
end $$;
rollback;

-- ---------------------------------------------------------------------
-- P06 — table operational status (0025)
-- ---------------------------------------------------------------------
-- <restaurant-uuid>       restaurant A id
-- <table-uuid>            an active table belonging to restaurant A
-- <kitchen-user-uuid>     active kitchen staff of restaurant A
-- <customer-user-uuid>    signed-in user with no staff role
-- <other-staff-user-uuid> owner/manager of a different restaurant B
--
-- No new policy is added: `tables_staff_manage` already scopes writes with
-- is_staff_of(restaurant_id), and `tables_public_read` is SELECT-only.
-- These checks prove the new `status` column inherits that behaviour.

-- (at) Kitchen staff of A can update A's table status. Expected: UPDATE 1.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<kitchen-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
update public.tables
   set status = 'needs_cleaning'
 where id = '<table-uuid>';
rollback;

-- (au) A signed-in customer cannot update a table. Expected: UPDATE 0.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<customer-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
update public.tables
   set status = 'available'
 where id = '<table-uuid>';
rollback;

-- (av) Anon cannot update a table at all. Expected: UPDATE 0.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
update public.tables
   set status = 'available'
 where id = '<table-uuid>';
rollback;

-- (aw) Staff of restaurant B cannot update A's table status. Expected:
--      UPDATE 0 (the row is invisible under `tables_staff_manage`).
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<other-staff-user-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
update public.tables
   set status = 'occupied'
 where id = '<table-uuid>';
rollback;
