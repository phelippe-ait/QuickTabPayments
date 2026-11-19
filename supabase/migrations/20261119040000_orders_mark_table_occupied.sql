-- =====================================================================
-- Confirmed orders occupy their table
-- ---------------------------------------------------------------------
-- Staff asked for the floor plan to reflect service automatically:
--   * when a customer order is confirmed (payment succeeded) the table
--     becomes occupied;
--   * when staff create an order it is confirmed immediately, so the same
--     rule applies;
--   * staff still own the reverse transition — nothing auto-frees a table.
--
-- The trigger keeps this out of `place_order` / `staff_place_order` bodies
-- (and away from the Stripe webhook), so every confirmation path behaves the
-- same. Pending/unpaid checkouts do not occupy a table.
--
-- Safe to re-run.
-- =====================================================================

create or replace function public.mark_table_occupied_for_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.table_id is not null
     and new.status = 'confirmed'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    update public.tables
       set status = 'occupied'
     where id = new.table_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_mark_table_occupied on public.orders;
create trigger trg_orders_mark_table_occupied
  after insert or update of status on public.orders
  for each row execute function public.mark_table_occupied_for_order();

comment on function public.mark_table_occupied_for_order() is
  'Marks a table occupied when an order becomes confirmed. Staff still mark tables free/cleaning; orders never auto-free a table.';
