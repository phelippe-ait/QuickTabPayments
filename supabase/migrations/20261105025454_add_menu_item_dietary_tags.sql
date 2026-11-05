-- Store dietary claims separately from allergen disclosures on menu items.
alter table public.menu_items
  add column if not exists dietary_tags text[] not null default '{}';

comment on column public.menu_items.dietary_tags is
  'Dietary labels shown to customers, such as Vegetarian, Vegan, and Halal.';
