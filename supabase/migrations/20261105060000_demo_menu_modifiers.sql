-- Give the demo menu real option data so the customer item dialog can show
-- and price customizations. Scoped to the demo restaurant and safe to rerun.
do $$
declare
  v_restaurant uuid;
begin
  select id into v_restaurant
  from public.restaurants
  where slug = 'quicktab-demo-cafe';

  if v_restaurant is null then
    raise notice 'quicktab-demo-cafe not found; skipping demo modifier setup';
    return;
  end if;

  insert into public.modifier_groups
    (restaurant_id, name, selection_type, min_selections, max_selections, is_required, display_order)
  select v_restaurant, g.name, g.selection_type::public.modifier_selection,
         g.min_selections, g.max_selections, false, g.display_order
  from (values
    ('Size',        'single', 0, 1, 10),
    ('Milk',        'single', 0, 1, 20),
    ('Strength',    'single', 0, 1, 30),
    ('Sweetness',   'single', 0, 1, 40),
    ('Temperature', 'single', 0, 1, 50),
    ('Extras',      'multiple', 0, 3, 10)
  ) as g(name, selection_type, min_selections, max_selections, display_order)
  where not exists (
    select 1 from public.modifier_groups existing
    where existing.restaurant_id = v_restaurant and existing.name = g.name
  );

  insert into public.modifiers (modifier_group_id, name, price_adjustment, display_order)
  select g.id, option.name, option.price_adjustment, option.display_order
  from public.modifier_groups g
  join (values
    ('Size',        'Regular',          0.00::numeric, 0),
    ('Size',        'Large',            1.00::numeric, 1),
    ('Milk',        'Regular milk',     0.00::numeric, 0),
    ('Milk',        'Skim',             0.00::numeric, 1),
    ('Milk',        'Soy',              0.50::numeric, 2),
    ('Milk',        'Almond',           0.50::numeric, 3),
    ('Milk',        'Oat',              0.50::numeric, 4),
    ('Strength',    'Regular',          0.00::numeric, 0),
    ('Strength',    'Strong',           0.50::numeric, 1),
    ('Strength',    'Weak',             0.00::numeric, 2),
    ('Sweetness',   'No sugar',         0.00::numeric, 0),
    ('Sweetness',   '1 Sugar',          0.00::numeric, 1),
    ('Sweetness',   '2 Sugar',          0.00::numeric, 2),
    ('Sweetness',   '3 Sugar',          0.00::numeric, 3),
    ('Sweetness',   'Half Sugar',       0.00::numeric, 4),
    ('Sweetness',   '1 Sweetener',      0.00::numeric, 5),
    ('Sweetness',   '2 Sweetener',      0.00::numeric, 6),
    ('Temperature', 'Standard',         0.00::numeric, 0),
    ('Temperature', 'Extra Hot',        0.00::numeric, 1),
    ('Temperature', 'Warm',             0.00::numeric, 2),
    ('Extras',      'Add avocado',      2.00::numeric, 0),
    ('Extras',      'Extra bacon',      3.00::numeric, 1),
    ('Extras',      'Add hash brown',   2.50::numeric, 2)
  ) as option(group_name, name, price_adjustment, display_order)
    on option.group_name = g.name
  where g.restaurant_id = v_restaurant
    and not exists (
      select 1 from public.modifiers existing
      where existing.modifier_group_id = g.id and existing.name = option.name
    );

  insert into public.menu_item_modifier_groups (menu_item_id, modifier_group_id, display_order)
  select i.id, g.id, g.display_order
  from public.menu_items i
  join public.modifier_groups g on g.restaurant_id = i.restaurant_id
  where i.restaurant_id = v_restaurant
    and (
      (i.name in ('Flat White', 'Mocha', 'Cappuccino')
        and g.name in ('Size', 'Milk', 'Strength', 'Sweetness', 'Temperature'))
      or (i.name = 'Ceremonial Matcha'
        and g.name in ('Size', 'Milk', 'Sweetness', 'Temperature'))
      or (i.name = 'Bacon & Egg Roll' and g.name = 'Extras')
    )
  on conflict (menu_item_id, modifier_group_id) do nothing;
end;
$$;
