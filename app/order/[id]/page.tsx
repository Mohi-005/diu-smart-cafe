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
};

function formatPaymentMethod(method: string | null) {
  if (!method) {
    return "Not specified";
  }

  if (method === "bkash") {
    return "bKash";
  }

  if (method === "nagad") {
    return "Nagad";
  }

  if (method === "cash") {
    return "Cash";
  }

  return method;
}

function formatPaymentStatus(status: string) {
  if (status === "paid") {
    return "Paid ✓";
  }

  if (status === "submitted") {
    return "Verification Pending";
  }

  if (status === "refund_pending") {
    return "Refund Pending";
  }

  if (status === "refunded") {
    return "Refunded";
  }

  if (status === "failed") {
    return "Failed";
  }

  if (status === "unpaid") {
    return "Unpaid";
  }

  return status.replaceAll("_", " ");
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const supabase = createClient();

  const [order, setOrder] = useState<Order | null>(null);
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          "id, payment_stage, amount, status, payment_method, transaction_id"
        )
        .eq("order_id", orderId)
        .eq("student_id", user.id);

      if (paymentError) {
        setError(paymentError.message);
        setLoading(false);
        return;
      }

      setPayments(paymentData || []);
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
          label: "Payment Verification Pending",
          description:
            "Your advance payment has been submitted and is waiting for shopkeeper verification.",
          badgeClass:
            "border-amber-200 bg-amber-50 text-amber-700",
          statusClass: "text-amber-700",
        }
      : orderStatus === "confirmed"
        ? {
            label: "Order Confirmed",
            description:
              "Your advance payment has been verified and your order is confirmed.",
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
          title: "Advance Payment Verified ✓",
          description:
            "Your advance payment has been verified by the shopkeeper.",
          className:
            "border-emerald-200 bg-emerald-50 text-emerald-800",
        }
      : advanceStatus === "submitted"
        ? {
            title: "Advance Payment Submitted",
            description:
              "Your payment has been submitted and is waiting for shopkeeper verification.",
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
                  ? "Your token is assigned, but the order still needs payment verification."
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

            {!remainingPayment && remainingAmount === 0 && (
              <div className="rounded-xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-600">
                No remaining payment is required.
              </div>
            )}
          </div>

          {/* Advance Payment Status */}
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
                Method:{" "}
                {formatPaymentMethod(
                  advancePayment.payment_method
                )}
              </p>
            )}
          </div>

          {/* Payment History */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Payment History
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-950">
                Payment Details
              </h2>
            </div>

            {/* Advance Payment */}
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
                    Advance Payment
                  </p>

                  <p className="mt-1 text-xl font-black text-slate-950">
                    ৳
                    {advancePayment
                      ? Number(advancePayment.amount).toFixed(2)
                      : "0.00"}
                  </p>
                </div>

                <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">
                  {formatPaymentStatus(
                    advancePayment?.status ?? "unpaid"
                  )}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Payment Method
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {formatPaymentMethod(
                      advancePayment?.payment_method ?? null
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Transaction ID
                  </p>

                  <p className="mt-1 break-all font-bold text-slate-900">
                    {advancePayment?.transaction_id ||
                      (advancePayment?.payment_method === "cash"
                        ? "Not applicable — Cash payment"
                        : "Not available")}
                  </p>
                </div>
              </div>
            </div>

            {/* Remaining Payment */}
            <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-orange-700">
                    Remaining Payment
                  </p>

                  <p className="mt-1 text-xl font-black text-slate-950">
                    ৳
                    {remainingPayment
                      ? Number(remainingPayment.amount).toFixed(2)
                      : remainingAmount.toFixed(2)}
                  </p>
                </div>

                <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-orange-700">
                  {remainingPayment
                    ? formatPaymentStatus(
                        remainingPayment.status
                      )
                    : remainingAmount === 0
                      ? "Not Required"
                      : "Pending"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Payment Method
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {remainingPayment
                      ? formatPaymentMethod(
                          remainingPayment.payment_method
                        )
                      : remainingAmount === 0
                        ? "Not required"
                        : "Not paid yet"}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Transaction ID
                  </p>

                  <p className="mt-1 break-all font-bold text-slate-900">
                    {remainingPayment?.transaction_id ||
                      (remainingPayment?.payment_method === "cash"
                        ? "Not applicable — Cash payment"
                        : remainingAmount === 0
                          ? "Not required"
                          : "Not available")}
                  </p>
                </div>
              </div>
            </div>
          </div>

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