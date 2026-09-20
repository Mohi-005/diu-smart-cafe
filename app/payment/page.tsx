import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import AdvancePaymentForm from "@/components/student/AdvancePaymentForm";

type PaymentPageProps = {
  searchParams?: Promise<{
    order?: string;
  }>;
};

export default async function PaymentPage({
  searchParams,
}: PaymentPageProps) {
  const params = await searchParams;
  const orderId = params?.order;

  if (!orderId) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900">
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-2xl">
              !
            </div>

            <p className="mt-6 text-sm font-bold uppercase tracking-wider text-red-600">
              Payment
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Payment information is missing
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              No order was provided for this payment page.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/menu"
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Browse Menu
              </Link>

              <Link
                href="/cart"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Cart
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectPath = `/payment?order=${encodeURIComponent(orderId)}`;

    redirect(
      `/login?redirect=${encodeURIComponent(redirectPath)}`
    );
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id,
      token_code,
      total_amount,
      status,
      cancellation_deadline_at,
      student_id,
      cafes (
        name,
        bkash_number
      )
      `
    )
    .eq("id", orderId)
    .eq("student_id", user.id)
    .maybeSingle();

  const { data: payment, error: paymentError } =
    await supabase
      .from("payments")
      .select(
        `
        id,
        order_id,
        student_id,
        payment_stage,
        amount,
        status,
        payment_method,
        transaction_id
        `
      )
      .eq("order_id", orderId)
      .eq("student_id", user.id)
      .eq("payment_stage", "advance")
      .maybeSingle();

  if (
    orderError ||
    paymentError ||
    !order ||
    !payment
  ) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900">
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-600">
              !
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm font-bold uppercase tracking-wider text-red-600">
                Payment
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                Unable to load payment details
              </h1>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                We could not load the payment information for this
                order. Please return and try again.
              </p>
            </div>

            {orderError && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-800">
                  Order information could not be loaded.
                </p>
              </div>
            )}

            {paymentError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-800">
                  Payment information could not be loaded.
                </p>
              </div>
            )}

            {!order && !orderError && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm leading-6 text-amber-800">
                  The order was not found or does not belong to this
                  account.
                </p>
              </div>
            )}

            {!payment && !paymentError && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm leading-6 text-amber-800">
                  The required payment record was not found.
                </p>
              </div>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/student"
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Student Dashboard
              </Link>

              <Link
                href="/menu"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Browse Menu
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const cafeData = Array.isArray(order.cafes)
    ? order.cafes[0]
    : order.cafes;

  const orderTotal = Number(order.total_amount) || 0;
  const requiredPayment = Number(payment.amount) || 0;

  /*
    Full payment = Instant Buy
    Half payment = Pre-order
  */
  const isInstantBuy =
    requiredPayment >= orderTotal - 0.01;

  const orderType = isInstantBuy
    ? "instant"
    : "preorder";

  const paymentStatus = String(payment.status);

  const paymentStatusLabel =
    paymentStatus === "unpaid"
      ? "Payment Required"
      : paymentStatus === "submitted"
        ? "Payment Submitted"
        : paymentStatus === "paid"
          ? "Payment Verified"
          : paymentStatus === "failed"
            ? "Payment Failed"
            : paymentStatus === "refund_pending"
              ? "Refund Pending"
              : paymentStatus === "refunded"
                ? "Refunded"
                : paymentStatus === "non_refundable"
                  ? "Non-refundable"
                  : paymentStatus;

  const paymentStatusClass =
    paymentStatus === "paid"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : paymentStatus === "submitted"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : paymentStatus === "failed"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-amber-200 bg-amber-50 text-amber-800";

  const paymentMessage =
    paymentStatus === "unpaid"
      ? isInstantBuy
        ? "Complete the full payment to confirm your Instant Buy order."
        : "Your 50% advance payment is required to continue the order."
      : paymentStatus === "submitted"
        ? isInstantBuy
          ? "Your full payment has been submitted and is waiting for verification."
          : "Your advance payment has been submitted and is waiting for verification."
        : paymentStatus === "paid"
          ? isInstantBuy
            ? "Your full payment has been received and your Instant Buy order is confirmed."
            : "Your advance payment has been received successfully. Your order is now confirmed."
          : paymentStatus === "failed"
            ? "The payment could not be completed. Please review the payment details and try again."
            : "Your payment record has been updated.";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="shrink-0">
            <p className="text-xl font-black text-slate-950">
              DIU{" "}
              <span className="text-emerald-600">
                Smart Cafe
              </span>
            </p>

            <p className="text-xs text-slate-500">
              Secure Checkout
            </p>
          </Link>

          <Link
            href="/student"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-10 lg:px-8 lg:py-12">
        <div className="text-center">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              isInstantBuy
                ? "bg-blue-50 text-blue-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {isInstantBuy
              ? "Instant Buy"
              : "Pre-order"}
          </span>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {isInstantBuy
              ? "Complete your payment"
              : "Complete your advance payment"}
          </h1>

          <p className="mt-3 text-sm text-slate-500 sm:text-base">
            {cafeData?.name ?? "DIU Cafe"}
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {/* Order Summary */}
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
                  Order summary
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Order #{order.token_code}
                </h2>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                {order.status}
              </span>
            </div>

            <div className="mt-6 space-y-4 rounded-2xl bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-5">
                <span className="text-sm text-slate-500">
                  Order token
                </span>

                <span className="font-black text-slate-950">
                  {order.token_code}
                </span>
              </div>

              <div className="flex items-center justify-between gap-5">
                <span className="text-sm text-slate-500">
                  Order total
                </span>

                <span className="font-black text-slate-950">
                  ৳{orderTotal.toFixed(2)}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between gap-5">
                  <span className="font-bold text-slate-700">
                    {isInstantBuy
                      ? "Required payment"
                      : "Required advance"}
                  </span>

                  <span className="text-2xl font-black text-emerald-600">
                    ৳{requiredPayment.toFixed(2)}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {isInstantBuy
                    ? "100% payment for Instant Buy"
                    : "50% advance payment"}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div
            className={`mt-7 rounded-2xl border p-5 ${paymentStatusClass}`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-bold">
                Payment status
              </p>

              <span className="w-fit rounded-full bg-white/70 px-3 py-1 text-xs font-bold">
                {paymentStatusLabel}
              </span>
            </div>

            <p className="mt-3 text-sm leading-6">
              {paymentMessage}
            </p>
          </div>

          {/* Cancellation / Instant Info */}
          {!isInstantBuy ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
              <p className="font-bold text-slate-900">
                Cancellation window
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                This pre-order can be cancelled within 5 minutes of the
                successful advance payment, subject to the order&apos;s
                current status and system rules.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="font-bold text-blue-800">
                ⚡ Instant Buy
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-700">
                This order does not use the 5-minute cancellation window.
                After successful payment submission, the order is
                confirmed immediately.
              </p>
            </div>
          )}

          {/* Payment Form */}
          <div className="mt-7">
            <AdvancePaymentForm
              orderId={order.id}
              amount={requiredPayment}
              paymentStatus={payment.status}
              orderType={orderType}
              bkashNumber={
                cafeData?.bkash_number ?? null
              }
              cashoutFeePercentage={1.85}
            />
          </div>

          {/* Navigation */}
          <div className="mt-7 flex flex-col gap-3 text-center sm:flex-row sm:justify-center">
            <Link
              href="/student"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Student Dashboard
            </Link>

            <Link
              href="/cart"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Return to Cart
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}