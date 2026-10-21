-- =====================================================================
-- QuickTab Admin — refunds (M6, D4)
-- ---------------------------------------------------------------------
-- Run AFTER 0009_orders_snapshot_and_stats.sql.
--
-- Stripe is stubbed: staff insert `succeeded` rows now, and the future
-- webhook (service role) will own real status transitions and
-- `stripe_refund_id`. Drop the staff insert/update policies when that lands.
--
-- Safe to re-run.
-- =====================================================================

do $$
begin
  create type public.refund_status as enum ('requested', 'succeeded', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.refunds (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id)       on delete restrict,
  payment_id       uuid not null references public.payments(id)     on delete restrict,
  order_item_id    uuid          references public.order_items(id)  on delete restrict,
  quantity         int           check (quantity is null or quantity > 0),
  amount           numeric(10,2) not null check (amount > 0),
  reason           text,
  status           public.refund_status not null default 'succeeded',
  stripe_refund_id text unique,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_refunds_order   on public.refunds(order_id);
create index if not exists idx_refunds_payment on public.refunds(payment_id);

comment on table public.refunds is
  'Refund records. Stripe call is stubbed; rows are written by staff until the webhook owns transitions.';

-- ---------------------------------------------------------------------
-- Amount guard: succeeded payments only, never exceed the payment.
-- ---------------------------------------------------------------------
create or replace function public.guard_refund_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment  public.payments;
  v_refunded numeric;
begin
  select * into v_payment
  from public.payments
  where id = new.payment_id;

  if not found then
    raise exception 'Payment not found for this refund'
      using errcode = '23503';
  end if;

  if v_payment.order_id <> new.order_id then
    raise exception 'Refund order does not match the payment order'
      using errcode = '23514';
  end if;

  if v_payment.status <> 'succeeded' then
    raise exception 'Only succeeded payments can be refunded'
      using errcode = '23514';
  end if;

  select coalesce(sum(amount), 0)
    into v_refunded
  from public.refunds
  where payment_id = new.payment_id
    and status = 'succeeded'
    and id is distinct from new.id;

  if v_refunded + new.amount > v_payment.amount then
    raise exception 'Refund amount exceeds the remaining payment balance'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_refund_amount on public.refunds;
create trigger guard_refund_amount
  before insert or update on public.refunds
  for each row execute function public.guard_refund_amount();

-- ---------------------------------------------------------------------
-- Quantity guard: line refunds are capped and priced by the snapshot.
-- ---------------------------------------------------------------------
create or replace function public.guard_refund_quantity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item     public.order_items;
  v_used     int;
  v_expected numeric;
begin
  if new.order_item_id is null then
    return new;
  end if;

  select * into v_item
  from public.order_items
  where id = new.order_item_id;

  if not found then
    raise exception 'Order line not found for this refund'
      using errcode = '23503';
  end if;

  if v_item.order_id <> new.order_id then
    raise exception 'Refund order does not match the order line'
      using errcode = '23514';
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'Line refunds require a positive quantity'
      using errcode = '23514';
  end if;

  if new.quantity > v_item.quantity then
    raise exception 'Refund quantity exceeds the ordered quantity'
      using errcode = '23514';
  end if;

  select coalesce(sum(quantity), 0)
    into v_used
  from public.refunds
  where order_item_id = new.order_item_id
    and status = 'succeeded'
    and id is distinct from new.id;

  if v_used + new.quantity > v_item.quantity then
    raise exception 'Refund quantity exceeds the remaining line quantity'
      using errcode = '23514';
  end if;

  v_expected := round(v_item.unit_price_snapshot * new.quantity, 2);
  if new.amount <> v_expected then
    raise exception 'Line refund amount must equal unit price × quantity'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_refund_quantity on public.refunds;
create trigger guard_refund_quantity
  before insert or update on public.refunds
  for each row execute function public.guard_refund_quantity();

-- ---------------------------------------------------------------------
-- RLS: staff read/write; no delete policy at all.
-- ---------------------------------------------------------------------
alter table public.refunds enable row level security;

drop policy if exists "refunds_select_own_or_staff" on public.refunds;
create policy "refunds_select_own_or_staff"
  on public.refunds for select
  using (
    exists (
      select 1
      from public.orders o
      where o.id = refunds.order_id
        and (
          o.customer_id = auth.uid()
          or public.is_staff_of(o.restaurant_id)
        )
    )
  );

drop policy if exists "refunds_staff_insert" on public.refunds;
create policy "refunds_staff_insert"
  on public.refunds for insert
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = refunds.order_id
        and public.is_staff_of(o.restaurant_id)
    )
  );

drop policy if exists "refunds_staff_update" on public.refunds;
create policy "refunds_staff_update"
  on public.refunds for update
  using (
    exists (
      select 1
      from public.orders o
      where o.id = refunds.order_id
        and public.is_staff_of(o.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = refunds.order_id
        and public.is_staff_of(o.restaurant_id)
    )
  );

-- Intentionally no DELETE policy: refund records are append-only from the app.
