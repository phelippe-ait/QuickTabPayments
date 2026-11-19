-- Version aligned to the hosted project's applied migration (was 20261105070000); see deepseek_plan/DB_STATE_EVIDENCE.md.
-- Sweetness and temperature are preferences; customers may leave both unset.
update public.modifier_groups g
set min_selections = 0,
    is_required = false
where g.name in ('Sweetness', 'Temperature')
  and g.restaurant_id = (
    select r.id from public.restaurants r where r.slug = 'quicktab-demo-cafe'
  );
