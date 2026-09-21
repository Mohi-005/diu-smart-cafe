"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  token_code: string;
  total_amount: number;
  status: string;
  cafe_id: string;
  created_at: string;
};

type Cafe = {
  id: string;
  name: string;
};

type Payment = {
  id: string;
  payment_stage: string;
  amount: number;
  status: string;
  payment_method: string | null;
  transaction_id: string | null;
  refund_method: string | null;
  refund_transaction_id: string | null;
};

type RefundHistory = {
  amount: number;
  payment_method: string | null;
  transaction_id: string | null;
  refund_method: string | null;
  refund_transaction_id: string | null;
  refunded_at: string;
};

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const supabase = createClient();

  const [order, setOrder] = useState<Order | null>(null);
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refundSecretCode, setRefundSecretCode] = useState<string | null>(null);
  const [refundHistory, setRefundHistory] = useState<RefundHistory[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingUnpaidOrder, setCancellingUnpaidOrder] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You are not logged in.");
        setLoading(false);
        return;
      }

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          "id, token_code, total_amount, status, cafe_id, created_at"
        )
        .eq("id", orderId)
        .eq("student_id", user.id)
        .maybeSingle();

      if (orderError) {
        setError(orderError.message);
        setLoading(false);
        return;
      }

      if (!orderData) {
        setError("Order not found.");
        setLoading(false);
        return;
      }

      setOrder(orderData);

      const { data: cafeData, error: cafeError } = await supabase
        .from("cafes")
        .select("id, name")
        .eq("id", orderData.cafe_id)
        .maybeSingle();

      if (!cafeError && cafeData) {
        setCafe(cafeData);
      }

      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .select(
          "id, payment_stage, amount, status, payment_method, transaction_id, refund_method, refund_transaction_id"
        )
        .eq("order_id", orderId)
        .eq("student_id", user.id);

      if (paymentError) {
        setError(paymentError.message);
        setLoading(false);
        return;
      }

      const loadedPayments = paymentData || [];
      setPayments(loadedPayments);

      const advance = loadedPayments.find(
        (payment) => payment.payment_stage === "advance"
      );

      if (
        advance &&
        ["submitted", "paid", "refund_pending"].includes(advance.status)
      ) {
        const { data: secretCode } = await supabase.rpc(
          "get_student_refund_code",
          {
            p_payment_id: advance.id,
          }
        );

        setRefundSecretCode(secretCode || null);
      } else {
        setRefundSecretCode(null);
      }

      const { data: refundData, error: refundError } = await supabase.rpc(
        "get_student_refund_history",
        {
          p_order_id: orderId,
        }
      );

      if (!refundError) {
        setRefundHistory(refundData || []);
      } else {
        setRefundHistory([]);
      }

      setLoading(false);
    }

    loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />

          <p className="mt-4 text-sm font-medium text-slate-500">
            Loading order...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-2xl font-black text-red-600">
            !
          </div>

          <h1 className="mt-5 text-2xl font-black text-slate-950">
            Unable to load order
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            {error}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Try Again
            </button>

            <button
              type="button"
              onClick={() => router.push("/student")}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Student Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!order) {
    return null;
  }

  const advancePayment = payments.find(
    (payment) => payment.payment_stage === "advance"
  );

  const remainingPayment = payments.find(
    (payment) => payment.payment_stage === "remaining"
  );

  const advancePaid =
    advancePayment?.status === "paid"
      ? Number(advancePayment.amount)
      : 0;

  const estimatedRemaining = Math.max(
    Number(order.total_amount) - advancePaid,
    0
  );

  const remainingAmount =
    remainingPayment?.status === "paid"
      ? 0
      : estimatedRemaining;

  const orderStatus = String(order.status);

  const orderStatusInfo =
    orderStatus === "payment_pending"
      ? {
          label: "Advance Payment Pending",
          description:
            "Your advance payment is still pending.",
          badgeClass:
            "border-amber-200 bg-amber-50 text-amber-700",
          statusClass: "text-amber-700",
        }
      : orderStatus === "confirmed"
        ? {
            label: "Order Confirmed",
            description:
              "Your advance payment has been received and your order is confirmed.",
            badgeClass:
              "border-blue-200 bg-blue-50 text-blue-700",
            statusClass: "text-blue-700",
          }
        : orderStatus === "preparing"
          ? {
              label: "Order is Being Prepared",
              description:
                "The shopkeeper is currently preparing your food.",
              badgeClass:
                "border-purple-200 bg-purple-50 text-purple-700",
              statusClass: "text-purple-700",
            }
          : orderStatus === "ready"
            ? {
                label: "Ready for Pickup",
                description:
                  "Your food is ready. You can collect your order using the token below.",
                badgeClass:
                  "border-emerald-200 bg-emerald-50 text-emerald-700",
                statusClass: "text-emerald-700",
              }
            : orderStatus === "collected"
              ? {
                  label: "Order Collected",
                  description:
                    "Your order has been successfully collected.",
                  badgeClass:
                    "border-emerald-200 bg-emerald-50 text-emerald-700",
                  statusClass: "text-emerald-700",
                }
              : orderStatus === "cancelled"
                ? {
                    label: "Order Cancelled",
                    description:
                      "This order has been cancelled.",
                    badgeClass:
                      "border-red-200 bg-red-50 text-red-700",
                    statusClass: "text-red-700",
                  }
                : {
                    label: orderStatus.replaceAll("_", " "),
                    description:
                      "Your order status has been updated.",
                    badgeClass:
                      "border-slate-200 bg-slate-100 text-slate-700",
                    statusClass: "text-slate-700",
                  };

  const advanceStatus = advancePayment?.status ?? "unpaid";

  const paymentStatusInfo =
    advanceStatus === "paid"
      ? {
          title: "Advance Payment Received ✓",
          description:
            "Your advance payment has been received successfully.",
          className:
            "border-emerald-200 bg-emerald-50 text-emerald-800",
        }
      : advanceStatus === "submitted"
        ? {
            title: "Advance Payment Submitted",
            description:
              "Your payment has been submitted. Your order is now being processed.",
            className:
              "border-amber-200 bg-amber-50 text-amber-800",
          }
        : advanceStatus === "refund_pending"
          ? {
              title: "Refund Pending",
              description:
                "Your advance payment is currently waiting for refund processing.",
              className:
                "border-amber-200 bg-amber-50 text-amber-800",
            }
          : advanceStatus === "refunded"
            ? {
                title: "Advance Payment Refunded",
                description:
                  "Your advance payment has been refunded.",
                className:
                  "border-blue-200 bg-blue-50 text-blue-800",
              }
            : advanceStatus === "failed"
              ? {
                  title: "Advance Payment Failed",
                  description:
                    "The advance payment was not completed successfully.",
                  className:
                    "border-red-200 bg-red-50 text-red-800",
                }
              : {
                  title: "Advance Payment Pending",
                  description:
                    "Your advance payment has not been submitted yet.",
                  className:
                    "border-slate-200 bg-slate-50 text-slate-700",
                };

  async function handleCancelUnpaidOrder() {
    if (
      !order ||
      order.status !== "payment_pending" ||
      !(advanceStatus === "unpaid" || advanceStatus === "failed") ||
      cancellingUnpaidOrder
    ) {
      return;
    }

    const confirmed = window.confirm(
      "এই order-এর কোনো advance payment এখনো দেওয়া হয়নি। আপনি কি এই orderটি cancel করতে চান?"
    );

    if (!confirmed) {
      return;
    }

    setCancellingUnpaidOrder(true);
    setError("");

    const { error: cancelError } = await supabase.rpc(
      "cancel_unpaid_pending_order",
      {
        p_order_id: order.id,
      }
    );

    if (cancelError) {
      setError(cancelError.message);
      setCancellingUnpaidOrder(false);
      return;
    }

    router.replace("/student/orders");
    router.refresh();
  }

  const showTokenMessage =
    orderStatus === "confirmed" ||
    orderStatus === "preparing" ||
    orderStatus === "ready" ||
    orderStatus === "collected";

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${orderStatusInfo.badgeClass}`}
          >
            {orderStatusInfo.label}
          </span>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {orderStatusInfo.label}
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
            {orderStatusInfo.description}
          </p>

          <p className="mt-2 text-sm font-semibold text-slate-600">
            {cafe?.name || "Cafe"}
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {/* Digital Token */}
          <div className="rounded-2xl bg-emerald-50 p-7 text-center sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
              Digital Order Token
            </p>

            <h2 className="mt-3 text-5xl font-black tracking-wider text-emerald-700">
              {order.token_code}
            </h2>

            <p className="mt-3 text-sm leading-6 text-emerald-700">
              {showTokenMessage
                ? "Keep this token ready when collecting your food."
                : orderStatus === "payment_pending"
                  ? "Your token is assigned, but the order still needs its advance payment."
                  : "This token is linked to your order."}
            </p>
          </div>

          {/* Order Status */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium text-slate-600">
                Order Status
              </span>

              <span
                className={`w-fit font-black uppercase tracking-wide ${orderStatusInfo.statusClass}`}
              >
                {orderStatus.replaceAll("_", " ")}
              </span>
            </div>
          </div>

          {/* Order Information */}
          <div className="mt-6 space-y-4">
            <div className="flex justify-between gap-5">
              <span className="text-sm text-slate-600">
                Order Total
              </span>

              <span className="font-bold text-slate-950">
                ৳{Number(order.total_amount).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between gap-5">
              <span className="text-sm text-slate-600">
                Advance Paid
              </span>

              <span className="font-bold text-emerald-600">
                ৳{advancePaid.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between gap-5 border-t border-slate-200 pt-4">
              <span className="font-semibold text-slate-700">
                Remaining
              </span>

              <span className="font-black text-orange-600">
                ৳{remainingAmount.toFixed(2)}
              </span>
            </div>

            {remainingPayment?.status === "paid" && (
              <div className="rounded-xl bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-700">
                Remaining payment completed ✓
              </div>
            )}
          </div>

          {/* Payment Status */}
          <div
            className={`mt-6 rounded-2xl border p-5 ${paymentStatusInfo.className}`}
          >
            <p className="font-black">
              {paymentStatusInfo.title}
            </p>

            <p className="mt-2 text-sm leading-6">
              {paymentStatusInfo.description}
            </p>

            {advancePayment?.payment_method && (
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide opacity-80">
                Advance Payment Method: {advancePayment.payment_method}
              </p>
            )}
          </div>


          {
            orderStatus === "payment_pending" &&
            (advanceStatus === "unpaid" || advanceStatus === "failed") && (
            <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
              <p className="font-black text-amber-900">
                Orderটি এখনো সম্পূর্ণ হয়নি
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                এই order-এর required advance payment এখনো দেওয়া হয়নি। আপনি কি orderটি সম্পূর্ণ করতে চান?
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/payment?order=${encodeURIComponent(order.id)}`
                    )
                  }
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
                >
                  Yes — Continue to Payment
                </button>

                <button
                  type="button"
                  onClick={handleCancelUnpaidOrder}
                  disabled={cancellingUnpaidOrder}
                  className="rounded-xl border border-red-300 bg-white px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancellingUnpaidOrder
                    ? "Cancelling..."
                    : "No — Cancel Order"}
                </button>
              </div>

              <p className="mt-3 text-xs leading-5 text-amber-700">
                Cancel করলে orderটি database-এ audit-এর জন্য থাকবে, কিন্তু student order history-তে আর দেখাবে না।
              </p>
            </div>
          )}

          {refundSecretCode && advanceStatus !== "refunded" && (
            <div className="mt-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-5">
              <p className="text-sm font-bold uppercase tracking-wider text-indigo-700">
                Refund Secret Code
              </p>

              <p className="mt-2 text-sm leading-6 text-indigo-700">
                Keep this 6-character code private. It is required when the shopkeeper processes your refund.
              </p>

              <div className="mt-4 rounded-xl bg-white px-5 py-4 text-center shadow-sm">
                <p className="font-mono text-3xl font-black tracking-[0.35em] text-indigo-700">
                  {refundSecretCode}
                </p>
              </div>
            </div>
          )}

          {advanceStatus === "refunded" && refundHistory.length > 0 && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-black text-emerald-800">
                Refund History
              </p>

              <p className="mt-2 text-sm leading-6 text-emerald-700">
                The Refund Secret Code is hidden after a successful refund because the code is single-use and must not remain reusable.
              </p>

              {refundHistory.map((refund, index) => (
                <div
                  key={`${refund.refunded_at}-${index}`}
                  className="mt-4 space-y-3 rounded-xl bg-white p-4"
                >
                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-slate-500">Refund Amount</span>
                    <span className="font-bold text-slate-900">
                      ৳{Number(refund.amount).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-slate-500">Refund Method</span>
                    <span className="font-bold text-slate-900">
                      {refund.refund_method || "Not available"}
                    </span>
                  </div>

                  {refund.refund_method === "bkash" && (
                    <div className="flex justify-between gap-4">
                      <span className="text-sm text-slate-500">Refund TrxID</span>
                      <span className="break-all text-right font-bold text-slate-900">
                        {refund.refund_transaction_id || "Not available"}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-slate-500">Refunded At</span>
                    <span className="text-right text-sm font-semibold text-slate-700">
                      {new Date(refund.refunded_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Created Time */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-500">
                Order created
              </span>

              <span className="text-sm font-semibold text-slate-700 sm:text-right">
                {new Date(order.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/student")}
              className="flex-1 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Student Dashboard
            </button>

            <button
              type="button"
              onClick={() => router.push("/student/orders")}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              My Orders
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}