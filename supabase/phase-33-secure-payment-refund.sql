/*
  PHASE 33 - Secure payment, cancellation and refund rules

  Apply this migration in the Supabase SQL editor after phase 32.
  Important: these rules live in Postgres so they cannot be bypassed from
  the browser by calling an RPC directly.
*/

alter table public.payments
  add column if not exists cashout_fee_percentage numeric(5,2) not null default 0,
  add column if not exists cashout_fee_amount numeric(12,2) not null default 0,
  add column if not exists charged_amount numeric(12,2),
  add column if not exists refund_secret_code text,
  add column if not exists refund_verification_attempts integer not null default 0,
  add column if not exists refund_verification_locked_until timestamptz;

create table if not exists public.refund_history (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  student_id uuid not null references auth.users(id) on delete restrict,
  cafe_id uuid not null references public.cafes(id) on delete restrict,
  refunded_by uuid not null references auth.users(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  cashout_fee_amount numeric(12,2) not null default 0 check (cashout_fee_amount >= 0),
  original_payment_method text,
  original_transaction_id text,
  refund_method text not null check (refund_method in ('cash', 'bkash')),
  refund_transaction_id text,
  refunded_at timestamptz not null default now(),
  check (
    (refund_method = 'cash' and refund_transaction_id is null)
    or (refund_method = 'bkash' and refund_transaction_id is not null)
  )
);

alter table public.refund_history
  add column if not exists cashout_fee_amount numeric(12,2) not null default 0,
  add column if not exists original_payment_method text,
  add column if not exists original_transaction_id text;

alter table public.refund_history enable row level security;

drop policy if exists "Students can read their own refund history" on public.refund_history;
create policy "Students can read their own refund history"
  on public.refund_history for select
  using (student_id = auth.uid());

drop policy if exists "Shopkeepers can insert their own refund history" on public.refund_history;
create policy "Shopkeepers can insert their own refund history"
  on public.refund_history for insert
  with check (
    refunded_by = auth.uid()
    and exists (
      select 1 from public.cafes c
      where c.id = cafe_id and c.owner_id = auth.uid()
    )
  );

/* The cancellation clock is never armed while an order merely exists. */
create or replace function public.prepare_instant_order(p_order_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders
  where id = p_order_id and student_id = auth.uid() for update;

  if not found then raise exception 'Order not found or does not belong to this account.'; end if;
  if v_order.status <> 'payment_pending' then raise exception 'This order is not available for Instant Buy setup.'; end if;

  update public.payments
  set amount = v_order.total_amount, status = 'unpaid', payment_method = null,
      transaction_id = null, cashout_fee_percentage = 0, cashout_fee_amount = 0,
      charged_amount = null, refund_secret_code = null,
      refund_verification_attempts = 0, refund_verification_locked_until = null
  where order_id = p_order_id and student_id = auth.uid() and payment_stage = 'advance';

  update public.orders set cancellation_deadline_at = null where id = p_order_id;
  return jsonb_build_object('success', true, 'order_id', p_order_id, 'order_type', 'instant_buy', 'amount', v_order.total_amount);
end;
$$;

/* bKash is charged on the stored, server-calculated final (discounted) amount. */
create or replace function public.submit_manual_payment(
  p_order_id uuid,
  p_payment_method text,
  p_transaction_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_method text := lower(trim(coalesce(p_payment_method, '')));
  v_txid text := nullif(trim(coalesce(p_transaction_id, '')), '');
  v_is_instant boolean;
  v_fee numeric(12,2) := 0;
  v_charged numeric(12,2);
  v_secret text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if v_method not in ('bkash', 'cash') then raise exception 'Only bKash and Cash are accepted.'; end if;

  select * into v_order from public.orders where id = p_order_id and student_id = auth.uid() for update;
  if not found then raise exception 'Order not found or does not belong to this account.'; end if;
  if v_order.status in ('cancelled', 'collected') then raise exception 'This order cannot receive a payment.'; end if;

  select * into v_payment from public.payments
  where order_id = p_order_id and student_id = auth.uid() and payment_stage = 'advance'
  order by created_at desc limit 1 for update;
  if not found or v_payment.status <> 'unpaid' then raise exception 'This payment is no longer available for submission.'; end if;

  v_is_instant := round(coalesce(v_payment.amount, 0), 2) >= round(coalesce(v_order.total_amount, 0), 2);

  if v_method = 'cash' then
    if not v_is_instant then raise exception 'Cash payment is available only for Instant Buy.'; end if;
    update public.payments set payment_method = 'cash', transaction_id = null, status = 'paid',
      cashout_fee_percentage = 0, cashout_fee_amount = 0, charged_amount = v_payment.amount,
      refund_secret_code = null
    where id = v_payment.id;
    update public.orders set status = 'confirmed', cancellation_deadline_at = null where id = p_order_id;
    return jsonb_build_object('success', true, 'payment_status', 'paid', 'order_status', 'confirmed', 'order_type', 'instant_buy', 'amount', v_payment.amount, 'cashout_fee_amount', 0, 'charged_amount', v_payment.amount);
  end if;

  if v_txid is null then raise exception 'bKash transaction ID is required.'; end if;
  if exists (select 1 from public.payments p where lower(trim(coalesce(p.transaction_id, ''))) = lower(v_txid) and p.id <> v_payment.id and p.status in ('submitted', 'paid', 'refund_pending', 'refunded')) then
    raise exception 'This transaction ID has already been used.';
  end if;

  v_fee := round(v_payment.amount * 0.0185, 2);
  v_charged := v_payment.amount + v_fee;
  v_secret := upper(substr(md5(random()::text || clock_timestamp()::text || v_payment.id::text), 1, 6));

  update public.payments set payment_method = 'bkash', transaction_id = v_txid, status = 'submitted',
    cashout_fee_percentage = 1.85, cashout_fee_amount = v_fee, charged_amount = v_charged,
    refund_secret_code = v_secret, refund_verification_attempts = 0, refund_verification_locked_until = null
  where id = v_payment.id;

  /* Only a pre-order bKash submission starts the 5-minute clock. */
  update public.orders set status = 'payment_pending',
    cancellation_deadline_at = case when v_is_instant then null else now() + interval '5 minutes' end
  where id = p_order_id;

  return jsonb_build_object('success', true, 'payment_status', 'submitted', 'order_status', 'payment_pending',
    'order_type', case when v_is_instant then 'instant_buy' else 'pre_order' end,
    'amount', v_payment.amount, 'cashout_fee_amount', v_fee, 'charged_amount', v_charged);
end;
$$;

create or replace function public.cancel_student_order(p_order_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_order public.orders%rowtype; v_payment public.payments%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id and student_id = auth.uid() for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.cancellation_deadline_at is null or v_order.cancellation_deadline_at <= now() then raise exception 'The cancellation window is closed.'; end if;
  select * into v_payment from public.payments where order_id = p_order_id and payment_stage = 'advance' order by created_at desc limit 1 for update;
  if not found or v_payment.payment_method <> 'bkash' or v_payment.status not in ('submitted', 'paid') then raise exception 'Only submitted bKash advance payments can be cancelled.'; end if;
  update public.orders set status = 'cancelled' where id = p_order_id;
  update public.payments set status = 'refund_pending' where id = v_payment.id;
  return jsonb_build_object('success', true, 'payment_id', v_payment.id, 'status', 'refund_pending');
end;
$$;

create or replace function public.get_student_refund_code(p_payment_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare v_code text;
begin
  select refund_secret_code into v_code from public.payments
  where id = p_payment_id and student_id = auth.uid() and status in ('submitted', 'paid', 'refund_pending');
  return v_code;
end;
$$;

create or replace function public.process_refund_advance_payment(
  p_payment_id uuid, p_original_transaction_id text, p_refund_code text,
  p_refund_method text, p_refund_transaction_id text default null
)
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare v_payment public.payments%rowtype; v_order public.orders%rowtype; v_method text := lower(trim(coalesce(p_refund_method, ''))); v_code text := upper(trim(coalesce(p_refund_code, ''))); v_refund_txid text := nullif(trim(coalesce(p_refund_transaction_id, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if v_method not in ('cash', 'bkash') then raise exception 'Refund method must be Cash or bKash.'; end if;
  if (v_method = 'bkash' and v_refund_txid is null) or (v_method = 'cash' and v_refund_txid is not null) then raise exception 'A bKash refund needs a new TrxID; a cash refund must not have one.'; end if;
  select p.* into v_payment from public.payments p where p.id = p_payment_id for update;
  if not found then raise exception 'Refund payment not found.'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not exists (select 1 from public.cafes c where c.id = v_order.cafe_id and c.owner_id = auth.uid() and c.is_active) then raise exception 'You can only refund orders for your own active shop.'; end if;
  if v_payment.status <> 'refund_pending' or v_payment.payment_stage <> 'advance' or v_order.status <> 'cancelled' then raise exception 'This payment is not eligible for refund.'; end if;
  if v_payment.refund_verification_locked_until is not null and v_payment.refund_verification_locked_until > now() then raise exception 'Refund verification is temporarily locked. Try again later.'; end if;
  if trim(coalesce(p_original_transaction_id, '')) <> coalesce(v_payment.transaction_id, '') or v_code <> coalesce(v_payment.refund_secret_code, '') then
    update public.payments set refund_verification_attempts = refund_verification_attempts + 1,
      refund_verification_locked_until = case when refund_verification_attempts + 1 >= 5 then now() + interval '15 minutes' else refund_verification_locked_until end
    where id = p_payment_id;
    raise exception 'Original TrxID or security code is incorrect.';
  end if;
  update public.payments set status = 'refunded', refund_method = v_method, refund_transaction_id = v_refund_txid,
    refund_secret_code = null, refund_verification_attempts = 0, refund_verification_locked_until = null where id = p_payment_id;
  insert into public.refund_history (payment_id, order_id, student_id, cafe_id, refunded_by, amount, cashout_fee_amount, original_payment_method, original_transaction_id, refund_method, refund_transaction_id)
  values (v_payment.id, v_order.id, v_order.student_id, v_order.cafe_id, auth.uid(), v_payment.amount, v_payment.cashout_fee_amount, v_payment.payment_method, v_payment.transaction_id, v_method, v_refund_txid);
  return jsonb_build_object('success', true, 'payment_id', v_payment.id, 'student_id', v_order.student_id);
end;
$$;

create or replace function public.get_student_refund_history(p_order_id uuid)
returns table(amount numeric, cashout_fee_amount numeric, payment_method text, transaction_id text, refund_method text, refund_transaction_id text, refunded_at timestamptz)
language sql security invoker set search_path = public as $$
  select r.amount, r.cashout_fee_amount, r.original_payment_method, r.original_transaction_id, r.refund_method, r.refund_transaction_id, r.refunded_at
  from public.refund_history r where r.order_id = p_order_id and r.student_id = auth.uid() order by r.refunded_at desc;
$$;

/* This queue is intentionally scoped by cafes.owner_id, not by a client cafe id. */
create or replace function public.get_pending_refund_payments_v2()
returns table(payment_id uuid, order_id uuid, cafe_id uuid, token_code text, amount numeric, payment_method text, transaction_id text)
language sql security definer set search_path = public as $$
  select p.id, o.id, o.cafe_id, o.token_code, p.amount, p.payment_method, p.transaction_id
  from public.payments p
  join public.orders o on o.id = p.order_id
  join public.cafes c on c.id = o.cafe_id
  where c.owner_id = auth.uid()
    and c.is_active
    and o.status = 'cancelled'
    and p.payment_stage = 'advance'
    and p.status = 'refund_pending'
  order by o.created_at asc;
$$;

revoke all on function public.prepare_instant_order(uuid) from public;
revoke all on function public.submit_manual_payment(uuid, text, text) from public;
revoke all on function public.cancel_student_order(uuid) from public;
revoke all on function public.get_student_refund_code(uuid) from public;
revoke all on function public.process_refund_advance_payment(uuid, text, text, text, text) from public;
revoke all on function public.get_student_refund_history(uuid) from public;
revoke all on function public.get_pending_refund_payments_v2() from public;
grant execute on function public.prepare_instant_order(uuid), public.submit_manual_payment(uuid, text, text), public.cancel_student_order(uuid), public.get_student_refund_code(uuid), public.process_refund_advance_payment(uuid, text, text, text, text), public.get_student_refund_history(uuid), public.get_pending_refund_payments_v2() to authenticated;
