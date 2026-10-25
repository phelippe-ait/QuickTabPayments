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
-- Placeholders:
--   <restaurant-slug>          demo restaurant slug (quicktab-demo-cafe)
--   <active-table-token>       tables.qr_token for an ACTIVE table
--   <inactive-table-token>     tables.qr_token for a DEACTIVATED table
--   <menu-item-uuid>           an available item of <restaurant-slug>
--   <other-restaurant-item>    an available item of a DIFFERENT restaurant
--
-- Helper query:
-- select r.slug, t.table_number, t.qr_token, t.is_active
--   from public.tables t join public.restaurants r on r.id = t.restaurant_id
--  where r.slug = 'quicktab-demo-cafe' order by t.table_number;

-- (t) Function grants. Expected: anon true, authenticated true for both.
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
  ) as authenticated_can_track;

-- (u) Guest place_order + tracking happy path. All assertions run inside one
-- rollback transaction, so no demo data is changed. Expected: NOTICE
-- "phase5 place_order ok" and anon order count 0.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;

do $$
declare
  v_expected_price numeric;
  v_placed         jsonb;
  v_tracked        jsonb;
  v_token          text;
  v_items          int;
begin
  select price into v_expected_price
  from public.menu_items
  where id = '<menu-item-uuid>' and is_available;

  -- A tampered client price in the payload must be ignored.
  v_placed := public.place_order(
    '<restaurant-slug>',
    '<active-table-token>',
    'RLS Phase 5 Guest',
    'Window seat please',
    jsonb_build_array(
      jsonb_build_object(
        'menu_item_id', '<menu-item-uuid>',
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
-- Expected: ERROR P0001 table_not_found (the whole call rolls back).
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
select public.place_order(
  '<restaurant-slug>',
  '<inactive-table-token>',
  'RLS Deactivated Table',
  null,
  jsonb_build_array(
    jsonb_build_object('menu_item_id', '<menu-item-uuid>', 'quantity', 1)
  )
);
rollback;

-- (w) Cross-restaurant menu items are rejected and nothing is written.
-- Expected: ERROR P0001 menu_item_unavailable.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
select public.place_order(
  '<restaurant-slug>',
  '<active-table-token>',
  'RLS Cross Restaurant',
  null,
  jsonb_build_array(
    jsonb_build_object('menu_item_id', '<other-restaurant-item>', 'quantity', 1)
  )
);
rollback;

-- (x) An empty cart is rejected. Expected: ERROR P0001 empty_cart.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
select public.place_order(
  '<restaurant-slug>', '<active-table-token>', 'RLS Empty Cart', null, '[]'::jsonb
);
rollback;

-- (y) resolve_qr_context distinguishes a deactivated table.
-- Expected: {"error": "table_inactive"}.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
select public.resolve_qr_context('<restaurant-slug>', '<inactive-table-token>');
rollback;

-- (z) A wrong-restaurant table token is rejected by the resolver.
-- Expected: {"error": "table_not_found"}.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'anon')::text,
  true
);
set local role anon;
select public.resolve_qr_context('<restaurant-slug>', '<other-restaurant-table-token>');
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

