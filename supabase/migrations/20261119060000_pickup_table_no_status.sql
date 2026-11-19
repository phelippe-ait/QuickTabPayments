-- =====================================================================
-- Pickup table has no occupancy status
-- ---------------------------------------------------------------------
-- The counter / pick-up point is not a seat. It should never show or change
-- occupied/available/needs-cleaning, and it is hidden from the staff floor
-- plan. It remains selectable in staff New order and by customer QR.
--
-- Safe to re-run.
-- =====================================================================

-- Confirmed orders only occupy real tables.
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
     where id = new.table_id
       and not is_system;
  end if;

  return new;
end;
$$;

-- Reset any status the pickup point picked up before this rule.
update public.tables
   set status = 'available'
 where is_system
   and status <> 'available';

-- Freeze status on system tables. is_active remains changeable so owners can
-- enable/disable the pickup point.
create or replace function public.guard_system_table()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'system_table_immutable' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.is_system and not public.is_privileged_caller() then
      raise exception 'system_table_immutable' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.is_system is distinct from old.is_system
     and not public.is_privileged_caller() then
    raise exception 'system_table_immutable' using errcode = '42501';
  end if;

  if old.is_system and (
    new.restaurant_id  is distinct from old.restaurant_id
    or new.table_number  is distinct from old.table_number
    or new.qr_token      is distinct from old.qr_token
    or new.location_label is distinct from old.location_label
    or new.seats         is distinct from old.seats
    or new.created_at    is distinct from old.created_at
    or new.status        is distinct from old.status
  ) then
    raise exception 'system_table_immutable' using errcode = '42501';
  end if;

  return new;
end;
$$;
