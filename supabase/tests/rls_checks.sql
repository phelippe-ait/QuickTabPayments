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
