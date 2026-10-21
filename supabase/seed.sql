-- =====================================================================
-- QuickTab — demo seed data
-- ---------------------------------------------------------------------
-- Run AFTER migrations 0009 (and again after 0010 to add refund rows).
-- Target: the existing restaurant with slug = 'quicktab-demo-cafe'.
--
-- Prerequisites (dashboard → Authentication → Users, email confirmed):
--   owner@quicktab.demo  (may already exist)
--   manager@quicktab.demo
--   kitchen@quicktab.demo
--
-- Safe to re-run: categories/items are guarded by name, tables by
-- (restaurant_id, table_number), orders by order_number. Existing order
-- line items are never duplicated because the parent order is skipped.
--
-- ---------------------------------------------------------------------
-- TEARDOWN (uncomment and run to reset the demo restaurant before a
-- fresh seed; scoped to quicktab-demo-cafe):
-- ---------------------------------------------------------------------
-- do $$
-- declare r uuid;
-- begin
--   select id into r from public.restaurants where slug = 'quicktab-demo-cafe';
--   if r is null then return; end if;
--   if to_regclass('public.refunds') is not null then
--     delete from public.refunds where order_id in (select id from public.orders where restaurant_id = r);
--   end if;
--   delete from public.payments   where order_id in (select id from public.orders where restaurant_id = r);
--   delete from public.order_items where order_id in (select id from public.orders where restaurant_id = r);
--   delete from public.orders     where restaurant_id = r;
--   delete from public.qr_sessions where table_id in (select id from public.tables where restaurant_id = r);
--   delete from public.tables     where restaurant_id = r;
--   delete from public.menu_items where restaurant_id = r;
--   delete from public.menu_categories where restaurant_id = r;
-- end $$;
-- =====================================================================

do $$
declare
  v_restaurant uuid;
  v_owner      uuid;
  v_order      uuid;
  v_payment    uuid;
  v_item       uuid;
  r            record;
begin
  select id, owner_id into v_restaurant, v_owner
  from public.restaurants
  where slug = 'quicktab-demo-cafe';

  if v_restaurant is null then
    raise exception 'Restaurant quicktab-demo-cafe not found. Create/onboard it first.';
  end if;

  -- -------------------------------------------------------------------
  -- Staff: profile names + memberships (accounts must already exist)
  -- -------------------------------------------------------------------
  update public.profiles
     set first_name = 'Maya', last_name = 'Johnson'
   where lower(email) = 'manager@quicktab.demo';

  update public.profiles
     set first_name = 'Theo', last_name = 'Martin'
   where lower(email) = 'kitchen@quicktab.demo';

  insert into public.restaurant_staff (restaurant_id, user_id, role, is_active)
  select v_restaurant, p.id, 'manager', true
  from public.profiles p
  where lower(p.email) = 'manager@quicktab.demo'
  on conflict (restaurant_id, user_id) do update
    set role = 'manager', is_active = true;

  insert into public.restaurant_staff (restaurant_id, user_id, role, is_active)
  select v_restaurant, p.id, 'kitchen', true
  from public.profiles p
  where lower(p.email) = 'kitchen@quicktab.demo'
  on conflict (restaurant_id, user_id) do update
    set role = 'kitchen', is_active = true;

  insert into public.restaurant_staff (restaurant_id, user_id, role, is_active)
  select v_restaurant, v_owner, 'owner', true
  on conflict (restaurant_id, user_id) do update
    set role = 'owner', is_active = true;

  -- -------------------------------------------------------------------
  -- Categories
  -- -------------------------------------------------------------------
  insert into public.menu_categories (restaurant_id, name, description, display_order)
  select v_restaurant, x.name, x.description, x.display_order
  from (values
    ('Hot Beverages', 'Coffee, tea, and espresso drinks', 0),
    ('Breakfast',     'All-day breakfast plates',          10),
    ('Lunch',         'Toasted and savoury lunch options', 20),
    ('Pastries',      'Baked fresh every morning',         30)
  ) as x(name, description, display_order)
  where not exists (
    select 1 from public.menu_categories c
    where c.restaurant_id = v_restaurant and lower(c.name) = lower(x.name)
  );

  -- -------------------------------------------------------------------
  -- Menu items (12)
  -- -------------------------------------------------------------------
  insert into public.menu_items
    (restaurant_id, category_id, name, description, price, image_url, is_available, display_order, prep_time_minutes)
  select
    v_restaurant, c.id, x.name, x.description, x.price, x.image_url,
    x.is_available, x.display_order, x.prep_time_minutes
  from (values
    ('Hot Beverages', 'Flat White',          'Smooth, creamy, and just the right amount of coffee kick.', 4.70, '/menu/flat-white.jpg', true,  0, 4),
    ('Hot Beverages', 'Babyccino',           'Steamed milk topped with a gentle sprinkle of cocoa.',      2.50, '/menu/babyccino.jpg', true,  1, 3),
    ('Hot Beverages', 'Mocha',               'Espresso, chocolate, and steamed milk.',                    5.00, '/menu/mocha.jpg',     true,  2, 5),
    ('Hot Beverages', 'Cappuccino',          'Silky, rich, with a generous cap of velvety foam.',          4.50, '/menu/cappuccino.jpg', false, 3, 4),
    ('Breakfast',     'Ceremonial Matcha',   'Premium matcha whisked with your choice of milk.',           5.80, '/menu/matcha.jpg',    true,  4, 5),
    ('Breakfast',     'Avocado Toast',       'Sourdough, smashed avocado, feta, and chilli flakes.',      14.00, null,                  true,  5, 8),
    ('Breakfast',     'Bacon & Egg Roll',    'Crispy bacon, fried egg, and house relish.',                12.50, null,                  true,  6, 9),
    ('Breakfast',     'Granola Bowl',        'Toasted oats, yoghurt, berries, and honey.',                13.00, null,                  true,  7, 4),
    ('Lunch',         'Toasted Focaccia',    'Seasonal fillings on rosemary focaccia.',                   15.50, null,                  true,  8, 10),
    ('Pastries',      'Croissant',           'Butter croissant, baked every morning.',                     4.20, null,                  true,  9, 1),
    ('Pastries',      'Pain au Chocolat',    'Laminated pastry with dark chocolate.',                      4.80, null,                  true, 10, 1),
    ('Pastries',      'Lemon Tart',          'Shortcrust pastry, lemon curd, torched meringue.',           6.50, null,                  true, 11, 1)
  ) as x(category, name, description, price, image_url, is_available, display_order, prep_time_minutes)
  join public.menu_categories c
    on c.restaurant_id = v_restaurant and c.name = x.category
  where not exists (
    select 1 from public.menu_items i
    where i.restaurant_id = v_restaurant and i.name = x.name
  );

  -- -------------------------------------------------------------------
  -- Tables (keep existing T01; add T02–T08 + Pick-up)
  -- -------------------------------------------------------------------
  insert into public.tables (restaurant_id, table_number, location_label, seats, is_active)
  values
    (v_restaurant, 'T02',    'Indoors',  2, true),
    (v_restaurant, 'T03',    'Indoors',  4, true),
    (v_restaurant, 'T04',    'Indoors',  2, true),
    (v_restaurant, 'T05',    'Indoors',  4, true),
    (v_restaurant, 'T06',    'Indoors',  6, true),
    (v_restaurant, 'T07',    'Outdoors', 4, true),
    (v_restaurant, 'T08',    'Outdoors', 2, true),
    (v_restaurant, 'Pick-up', 'Pick-up', null, true)
  on conflict (restaurant_id, table_number) do update
    set location_label = excluded.location_label,
        seats = excluded.seats,
        is_active = excluded.is_active;

  -- -------------------------------------------------------------------
  -- Orders, line items, payments (and refunds when 0010 exists)
  -- -------------------------------------------------------------------
  for r in
    select * from (values
      -- order, status,       hours ago, table,    customer,        payment,    method,      lines
      ('1001', 'completed', 1,    'T01',     'Olivia Moore',  'succeeded', 'card',       '[{"item":"Flat White","qty":2},{"item":"Babyccino","qty":1}]'::jsonb),
      ('1002', 'preparing', 3,    'T05',     'James Smith',   'succeeded', 'card',       '[{"item":"Cappuccino","qty":2},{"item":"Mocha","qty":1}]'::jsonb),
      ('1003', 'completed', 5,    'T03',     'Emma Davis',    'succeeded', 'apple_pay',  '[{"item":"Ceremonial Matcha","qty":1}]'::jsonb),
      ('1004', 'pending',   1,    'T02',     'Liam Wilson',   'succeeded', 'google_pay', '[{"item":"Avocado Toast","qty":1},{"item":"Flat White","qty":1}]'::jsonb),
      ('1005', 'completed', 26,   'T04',     'Sophia Brown',  'succeeded', 'card',       '[{"item":"Granola Bowl","qty":1},{"item":"Flat White","qty":1}]'::jsonb),
      ('1006', 'completed', 29,   'T06',     'Noah Williams', 'succeeded', 'apple_pay',  '[{"item":"Bacon & Egg Roll","qty":2}]'::jsonb),
      ('1007', 'completed', 32,   'Pick-up', 'Ava Taylor',    'succeeded', 'card',       '[{"item":"Croissant","qty":1},{"item":"Cappuccino","qty":1}]'::jsonb),
      ('1008', 'completed', 35,   'T07',     'Ethan Clark',   'succeeded', 'card',       '[{"item":"Toasted Focaccia","qty":1},{"item":"Mocha","qty":1}]'::jsonb),
      ('1009', 'completed', 50,   'T08',     'Mia Lewis',     'succeeded', 'google_pay', '[{"item":"Pain au Chocolat","qty":2},{"item":"Flat White","qty":2}]'::jsonb),
      ('1010', 'ready',     2,    'Pick-up', null,            'succeeded', 'card',       '[{"item":"Lemon Tart","qty":1},{"item":"Babyccino","qty":1}]'::jsonb),
      ('1011', 'completed', 74,   'T01',     null,            'succeeded', 'card',       '[{"item":"Flat White","qty":1},{"item":"Croissant","qty":1}]'::jsonb),
      ('1012', 'completed', 78,   'T02',     'Isla Chen',     'succeeded', 'apple_pay',  '[{"item":"Avocado Toast","qty":2}]'::jsonb),
      ('1013', 'completed', 100,  'T03',     'Olivia Moore',  'succeeded', 'card',       '[{"item":"Ceremonial Matcha","qty":1}]'::jsonb),
      ('1014', 'completed', 122,  'T04',     'James Smith',   'succeeded', 'card',       '[{"item":"Flat White","qty":2},{"item":"Mocha","qty":2}]'::jsonb),
      ('1015', 'cancelled', 146,  'T06',     'Emma Davis',    'failed',    'card',       '[{"item":"Cappuccino","qty":1}]'::jsonb),
      ('1016', 'completed', 170,  'Pick-up', 'Sophia Brown',  'succeeded', 'google_pay', '[{"item":"Pain au Chocolat","qty":1},{"item":"Lemon Tart","qty":1}]'::jsonb)
    ) as t(order_number, status, hours_ago, table_number, customer_name, payment_status, method, lines)
  loop
    if exists (
      select 1 from public.orders
      where restaurant_id = v_restaurant and order_number = r.order_number
    ) then
      continue;
    end if;

    insert into public.orders (
      restaurant_id, table_id, customer_id, customer_name_snapshot,
      order_number, status, subtotal, tax, total, created_at, updated_at, completed_at
    )
    values (
      v_restaurant,
      (select id from public.tables where restaurant_id = v_restaurant and table_number = r.table_number),
      null,
      r.customer_name,
      r.order_number,
      r.status::public.order_status,
      0, 0, 0,
      now() - (r.hours_ago || ' hours')::interval,
      now() - (r.hours_ago || ' hours')::interval,
      case
        when r.status = 'completed' then now() - (r.hours_ago || ' hours')::interval + interval '25 minutes'
        when r.status = 'cancelled' then now() - (r.hours_ago || ' hours')::interval + interval '3 minutes'
        else null
      end
    )
    returning id into v_order;

    insert into public.order_items (
      order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, subtotal
    )
    select
      v_order, mi.id, mi.name, mi.price,
      (line ->> 'qty')::int,
      round(mi.price * (line ->> 'qty')::int, 2)
    from jsonb_array_elements(r.lines) as line
    join public.menu_items mi
      on mi.restaurant_id = v_restaurant and mi.name = (line ->> 'item');

    update public.orders o
       set subtotal = totals.subtotal,
           tax = round(totals.subtotal * 0.10, 2),
           total = totals.subtotal + round(totals.subtotal * 0.10, 2)
      from (
        select coalesce(sum(subtotal), 0) as subtotal
        from public.order_items
        where order_id = v_order
      ) as totals
     where o.id = v_order;

    insert into public.payments (
      order_id, stripe_payment_intent_id, status, amount, currency,
      payment_method_type, failure_reason, paid_at
    )
    select
      v_order,
      'pi_demo_' || r.order_number,
      r.payment_status::public.payment_status,
      o.total,
      'AUD',
      r.method::public.payment_method_type,
      case when r.payment_status = 'failed' then 'Card declined' else null end,
      case when r.payment_status = 'succeeded' then o.created_at + interval '2 minutes' else null end
    from public.orders o
    where o.id = v_order
    returning id into v_payment;

    -- Refunds are only seeded once migration 0010 has created the table.
    if to_regclass('public.refunds') is not null then
      if r.order_number = '1013' then
        insert into public.refunds (order_id, payment_id, amount, reason, status, created_by)
        select v_order, v_payment, o.total, 'Customer changed mind', 'succeeded', v_owner
        from public.orders o
        where o.id = v_order
          and not exists (select 1 from public.refunds rf where rf.payment_id = v_payment);
      elsif r.order_number = '1014' then
        select id into v_item
        from public.order_items
        where order_id = v_order and item_name_snapshot = 'Flat White'
        limit 1;

        insert into public.refunds (order_id, payment_id, order_item_id, quantity, amount, reason, status, created_by)
        select v_order, v_payment, v_item, 1, mi.price, 'One coffee remade', 'succeeded', v_owner
        from public.menu_items mi
        where mi.id = (select menu_item_id from public.order_items where id = v_item)
          and not exists (select 1 from public.refunds rf where rf.payment_id = v_payment);
      end if;
    end if;
  end loop;

  -- -------------------------------------------------------------------
  -- Refunds (only once migration 0010 exists; runs even when the orders
  -- were seeded before the refunds table existed)
  -- -------------------------------------------------------------------
  if to_regclass('public.refunds') is not null then
    insert into public.refunds (order_id, payment_id, amount, reason, status, created_by)
    select o.id, p.id, o.total, 'Customer changed mind', 'succeeded', v_owner
    from public.orders o
    join public.payments p on p.order_id = o.id
    where o.restaurant_id = v_restaurant
      and o.order_number = '1013'
      and p.status = 'succeeded'
      and not exists (select 1 from public.refunds rf where rf.payment_id = p.id);

    insert into public.refunds (order_id, payment_id, order_item_id, quantity, amount, reason, status, created_by)
    select o.id, p.id, oi.id, 1, oi.unit_price_snapshot, 'One coffee remade', 'succeeded', v_owner
    from public.orders o
    join public.payments p on p.order_id = o.id
    join public.order_items oi on oi.order_id = o.id
    where o.restaurant_id = v_restaurant
      and o.order_number = '1014'
      and p.status = 'succeeded'
      and oi.item_name_snapshot = 'Flat White'
      and oi.quantity >= 1
      and not exists (select 1 from public.refunds rf where rf.payment_id = p.id)
    limit 1;
  end if;
end $$;
