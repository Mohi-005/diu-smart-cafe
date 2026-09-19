/* =========================================================
   DIU SMART CAFE
   PHASE 32
   Manual bKash Verification + Instant Buy + Preparation Lock
   ========================================================= */


/* =========================================================
   1. PREPARE AN EXISTING ORDER FOR INSTANT BUY
   ---------------------------------------------------------
   create_pending_order() still creates the normal order/payment
   structure.

   This function converts that newly-created order into an
   Instant Buy order by changing the advance payment amount to
   the full order total.

   The cancellation deadline is immediately expired because
   Instant Buy does not use the 5-minute cancellation window.
   ========================================================= */

create or replace function public.prepare_instant_order(
  p_order_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
    and student_id = v_user_id
  for update;

  if not found then
    raise exception 'Order not found or does not belong to this account.';
  end if;

  if v_order.status <> 'payment_pending' then
    raise exception 'This order is not available for Instant Buy setup.';
  end if;

  select *
  into v_payment
  from public.payments
  where order_id = p_order_id
    and student_id = v_user_id
    and payment_stage = 'advance'
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Advance payment record was not found.';
  end if;

  update public.payments
  set
    amount = v_order.total_amount,
    status = 'unpaid',
    payment_method = null,
    transaction_id = null
  where id = v_payment.id;

  /*
   * Instant Buy does not use the 5-minute cancellation window.
   * Setting the deadline to the current time makes the existing
   * cancellation protection expire immediately.
   */
  update public.orders
  set cancellation_deadline_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_type', 'instant_buy',
    'amount', v_order.total_amount
  );
end;
$$;


/* =========================================================
   2. MANUAL PAYMENT SUBMISSION
   ---------------------------------------------------------
   Rules:

   PRE-ORDER:
     - bKash only
     - 50% amount
     - transaction ID required
     - payment becomes "submitted"
     - order stays "payment_pending"

   INSTANT BUY:
     - Cash or bKash
     - Cash = immediately paid
     - bKash = submitted for verification

   Nagad is intentionally disabled for now.
   ========================================================= */

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
  v_user_id uuid;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_method text;
  v_txid text;
  v_is_instant boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  v_method := lower(trim(coalesce(p_payment_method, '')));
  v_txid := nullif(trim(coalesce(p_transaction_id, '')), '');

  if v_method not in ('bkash', 'cash') then
    raise exception 'Currently only bKash and Cash are accepted.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
    and student_id = v_user_id
  for update;

  if not found then
    raise exception 'Order not found or does not belong to this account.';
  end if;

  if v_order.status in ('cancelled', 'collected') then
    raise exception 'This order cannot receive a payment.';
  end if;

  select *
  into v_payment
  from public.payments
  where order_id = p_order_id
    and student_id = v_user_id
    and payment_stage = 'advance'
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Payment record was not found.';
  end if;

  /*
   * Instant Buy is represented by the payment amount being the
   * full order total. Pre-order remains at 50%.
   */
  v_is_instant :=
    round(coalesce(v_payment.amount, 0)::numeric, 2)
    >=
    round(coalesce(v_order.total_amount, 0)::numeric, 2);

  if v_payment.status <> 'unpaid' then
    raise exception 'This payment is no longer available for submission.';
  end if;

  /* ---------------------------------------------------------
     DUPLICATE TRANSACTION CHECK
     --------------------------------------------------------- */

  if v_method = 'bkash' then

    if v_txid is null then
      raise exception 'bKash transaction ID is required.';
    end if;

    if exists (
      select 1
      from public.payments p
      where lower(trim(coalesce(p.transaction_id, ''))) = lower(v_txid)
        and p.id <> v_payment.id
        and p.status in ('submitted', 'paid')
    ) then
      raise exception 'This transaction ID has already been used.';
    end if;

    /*
     * Pre-order and Instant Buy both require manual verification
     * for bKash until the official bKash gateway is connected.
     */
    update public.payments
    set
      payment_method = 'bkash',
      transaction_id = v_txid,
      status = 'submitted'
    where id = v_payment.id;

    update public.orders
    set status = 'payment_pending'
    where id = p_order_id;

    return jsonb_build_object(
      'success', true,
      'payment_status', 'submitted',
      'order_status', 'payment_pending',
      'order_type',
        case
          when v_is_instant then 'instant_buy'
          else 'pre_order'
        end
    );

  end if;


  /* ---------------------------------------------------------
     CASH
     --------------------------------------------------------- */

  if v_method = 'cash' then

    if not v_is_instant then
      raise exception 'Cash payment is available only for Instant Buy.';
    end if;

    update public.payments
    set
      payment_method = 'cash',
      transaction_id = null,
      status = 'paid'
    where id = v_payment.id;

    update public.orders
    set status = 'confirmed'
    where id = p_order_id;

    return jsonb_build_object(
      'success', true,
      'payment_status', 'paid',
      'order_status', 'confirmed',
      'order_type', 'instant_buy'
    );

  end if;

  raise exception 'Unsupported payment method.';
end;
$$;


/* =========================================================
   3. SERVER-SIDE PREPARATION LOCK
   ---------------------------------------------------------
   Shopkeeper cannot start preparing a pre-order before the
   5-minute cancellation window finishes.

   Instant Buy can start immediately after confirmation.

   The existing update_shopkeeper_order_status() remains the
   underlying status-change function.
   ========================================================= */

create or replace function public.start_shopkeeper_order_preparing(
  p_order_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_is_instant boolean;
begin

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.status <> 'confirmed' then
    raise exception 'Only confirmed orders can start preparing.';
  end if;

  select *
  into v_payment
  from public.payments
  where order_id = p_order_id
    and payment_stage = 'advance'
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'Payment record was not found.';
  end if;

  v_is_instant :=
    round(coalesce(v_payment.amount, 0)::numeric, 2)
    >=
    round(coalesce(v_order.total_amount, 0)::numeric, 2);

  /*
   * Instant Buy:
   * no 5-minute preparation lock.
   */
  if v_is_instant then

    perform public.update_shopkeeper_order_status(
      p_order_id,
      'preparing'
    );

    return jsonb_build_object(
      'success', true,
      'order_type', 'instant_buy',
      'status', 'preparing'
    );

  end if;

  /*
   * Pre-order:
   * the 5-minute cancellation period must be complete.
   */
  if v_order.cancellation_deadline_at is not null
     and v_order.cancellation_deadline_at > now() then
    raise exception
      'Preparation is locked until the 5-minute cancellation window ends.';
  end if;

  perform public.update_shopkeeper_order_status(
    p_order_id,
    'preparing'
  );

  return jsonb_build_object(
    'success', true,
    'order_type', 'pre_order',
    'status', 'preparing'
  );
end;
$$;


/* =========================================================
   4. PERMISSIONS
   ========================================================= */

revoke all
on function public.prepare_instant_order(uuid)
from public;

grant execute
on function public.prepare_instant_order(uuid)
to authenticated;


revoke all
on function public.submit_manual_payment(uuid, text, text)
from public;

grant execute
on function public.submit_manual_payment(uuid, text, text)
to authenticated;


revoke all
on function public.start_shopkeeper_order_preparing(uuid)
from public;

grant execute
on function public.start_shopkeeper_order_preparing(uuid)
to authenticated;