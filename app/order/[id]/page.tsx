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
  bkash_number: string | null;
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
  cashout_fee_amount: number;
  payment_method: string | null;
  transaction_id: string | null;
  refund_method: string | null;
  refund_transaction_id: string | null;
  refunded_at: string;
};

type RemainingPaymentResult = {
  payment_stage?: string;
  payment_status?: string;
  amount?: number;
  cashout_fee_percentage?: number;
  cashout_fee_amount?: number;
  charged_amount?: number;
  payment_method?: string;
};

const BKASH_CASHOUT_FEE_PERCENTAGE = 1.85;

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const supabase = createClient();

  const [order, setOrder] = useState<Order | null>(null);
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refundSecretCode, setRefundSecretCode] =
    useState<string | null>(null);
  const [refundHistory, setRefundHistory] = useState<RefundHistory[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [remainingPaymentMethod, setRemainingPaymentMethod] =
    useState<"cash" | "bkash" | "nagad">("bkash");

  const [remainingTransactionId, setRemainingTransactionId] =
    useState("");

  const [submittingRemainingPayment, setSubmittingRemainingPayment] =
    useState(false);

  const [remainingPaymentMessage, setRemainingPaymentMessage] =
    useState("");

  const [remainingPaymentError, setRemainingPaymentError] =
    useState("");

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
      .select("id, name, bkash_number")
      .eq("id", orderData.cafe_id)
      .maybeSingle();

    if (!cafeError && cafeData) {
      setCafe(cafeData);
    }

    const { data: paymentData, error: paymentError } =
      await supabase
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
      ["submitted", "paid", "refund_pending"].includes(
        advance.status
      )
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

    const { data: refundData, error: refundError } =
      await supabase.rpc("get_student_refund_history", {
        p_order_id: orderId,
      });

    if (!refundError) {
      setRefundHistory(refundData || []);
    } else {
      setRefundHistory([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  function calculateBkashFee(amount: number) {
    return (
      Math.round(
        amount *
          (BKASH_CASHOUT_FEE_PERCENTAGE / 100) *
          100
      ) / 100
    );
  }

  function calculateBkashTotal(amount: number) {
    const fee = calculateBkashFee(amount);

    return Math.round((amount + fee) * 100) / 100;
  }

  async function submitRemainingPayment() {
    setRemainingPaymentError("");
    setRemainingPaymentMessage("");

    const safeRemainingAmount = Math.max(
      Number(remainingAmount),
      0
    );

    if (safeRemainingAmount <= 0) {
      setRemainingPaymentError(
        "There is no remaining payment due for this order."
      );
      return;
    }

    if (
      (remainingPaymentMethod === "bkash" ||
        remainingPaymentMethod === "nagad") &&
      !remainingTransactionId.trim()
    ) {
      setRemainingPaymentError(
        "bKash বা Nagad payment-এর জন্য Transaction ID দিতে হবে."
      );
      return;
    }

    if (
      remainingPaymentMethod === "bkash" &&
      !cafe?.bkash_number?.trim()
    ) {
      setRemainingPaymentError(
        "এই cafe-এর bKash number সেট করা নেই. Payment করার আগে cafe-এর bKash number সেট করতে হবে."
      );
      return;
    }

    const bkashFee = calculateBkashFee(
      safeRemainingAmount
    );

    const chargedAmount =
      remainingPaymentMethod === "bkash"
        ? calculateBkashTotal(safeRemainingAmount)
        : safeRemainingAmount;

    const paymentDescription =
      remainingPaymentMethod === "bkash"
        ? `Remaining food amount ৳${safeRemainingAmount.toFixed(
            2
          )}\n` +
          `bKash cash-out fee ৳${bkashFee.toFixed(
            2
          )}\n` +
          `Total payable ৳${chargedAmount.toFixed(2)}`
        : `Remaining payment ৳${safeRemainingAmount.toFixed(2)}`;

    const confirmed = window.confirm(
      `${paymentDescription}\n\nPayment submit করবেন?`
    );

    if (!confirmed) {
      return;
    }

    setSubmittingRemainingPayment(true);
    setRemainingPaymentError("");
    setRemainingPaymentMessage("");

    const {
      data,
      error: paymentError,
    } = await supabase.rpc(
      "submit_student_remaining_payment",
      {
        p_order_id: orderId,
        p_payment_method: remainingPaymentMethod,
        p_transaction_id:
          remainingPaymentMethod === "cash"
            ? null
            : remainingTransactionId.trim(),
      }
    );

    if (paymentError) {
      setRemainingPaymentError(
        paymentError.message
      );
      setSubmittingRemainingPayment(false);
      return;
    }

    const result: RemainingPaymentResult =
      data && typeof data === "object"
        ? (data as RemainingPaymentResult)
        : {};

    const serverAmount = Number(
      result.amount ?? safeRemainingAmount
    );

    const serverFee = Number(
      result.cashout_fee_amount ?? 0
    );

    const serverChargedAmount = Number(
      result.charged_amount ?? chargedAmount
    );

    setRemainingPaymentMessage(
      remainingPaymentMethod === "bkash"
        ? `Remaining payment submitted successfully. Food amount ৳${serverAmount.toFixed(
            2
          )}, bKash fee ৳${serverFee.toFixed(
            2
          )}, total paid ৳${serverChargedAmount.toFixed(
            2
          )}. Shopkeeper verification is required.`
        : `Remaining payment ৳${serverAmount.toFixed(
            2
          )} submitted successfully. Shopkeeper verification is required.`
    );

    setRemainingTransactionId("");

    await loadOrder();

    setSubmittingRemainingPayment(false);
  }

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

  const remainingPaid =
    remainingPayment?.status === "paid"
      ? Number(remainingPayment.amount)
      : 0;

  const estimatedRemaining = Math.max(
    Number(order.total_amount) -
      advancePaid -
      remainingPaid,
    0
  );

  const remainingAmount = estimatedRemaining;

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
                  "Your food is ready. Complete any remaining payment before collection.",
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

  const advanceStatus =
    advancePayment?.status ?? "unpaid";

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

  const showTokenMessage =
    orderStatus === "confirmed" ||
    orderStatus === "preparing" ||
    orderStatus === "ready" ||
    orderStatus === "collected";

  const remainingPaymentSubmitted =
    remainingPayment?.status === "submitted";

  const remainingPaymentPaid =
    remainingPayment?.status === "paid";

  const canSubmitRemainingPayment =
    orderStatus === "ready" &&
    remainingAmount > 0 &&
    !remainingPaymentSubmitted &&
    !remainingPaymentPaid;

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

            {remainingPaid > 0 && (
              <div className="flex justify-between gap-5">
                <span className="text-sm text-slate-600">
                  Remaining Paid
                </span>

                <span className="font-bold text-emerald-600">
                  ৳{remainingPaid.toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between gap-5 border-t border-slate-200 pt-4">
              <span className="font-semibold text-slate-700">
                Remaining Due
              </span>

              <span className="font-black text-orange-600">
                ৳{remainingAmount.toFixed(2)}
              </span>
            </div>
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
                Advance Payment Method:{" "}
                {advancePayment.payment_method}
              </p>
            )}

            {advancePayment?.transaction_id && (
              <p className="mt-2 text-xs font-semibold opacity-80">
                Advance TrxID:{" "}
                {advancePayment.transaction_id}
              </p>
            )}
          </div>

          {/* Remaining Payment */}
          {orderStatus === "ready" && (
            <section className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-orange-700">
                  Remaining Payment
                </p>

                <h3 className="mt-2 text-2xl font-black text-slate-950">
                  ৳{remainingAmount.toFixed(2)}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Complete the remaining payment before collecting your order.
                </p>
              </div>

              {remainingPaymentSubmitted && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-bold text-amber-800">
                    Remaining Payment Verification Pending
                  </p>

                  <p className="mt-2 text-sm leading-6 text-amber-700">
                    Your remaining payment has been submitted successfully.
                    The shopkeeper must verify it before the order can be
                    collected.
                  </p>

                  {remainingPayment?.payment_method && (
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-amber-700">
                      Method:{" "}
                      {remainingPayment.payment_method}
                    </p>
                  )}

                  {remainingPayment?.transaction_id && (
                    <p className="mt-2 break-all text-xs font-semibold text-amber-700">
                      TrxID:{" "}
                      {remainingPayment.transaction_id}
                    </p>
                  )}
                </div>
              )}

              {remainingPaymentPaid && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-bold text-emerald-800">
                    Remaining Payment Completed ✓
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-700">
                    Your remaining payment has been verified successfully.
                  </p>

                  {remainingPayment?.payment_method && (
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-emerald-700">
                      Method:{" "}
                      {remainingPayment.payment_method}
                    </p>
                  )}
                </div>
              )}

              {canSubmitRemainingPayment && (
                <>
                  <div className="mt-5">
                    <p className="mb-3 text-sm font-bold text-slate-700">
                      Select Payment Method
                    </p>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRemainingPaymentMethod("bkash");
                          setRemainingPaymentError("");
                        }}
                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                          remainingPaymentMethod === "bkash"
                            ? "border-pink-500 bg-pink-50 text-pink-700"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        bKash
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRemainingPaymentMethod("nagad");
                          setRemainingPaymentError("");
                        }}
                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                          remainingPaymentMethod === "nagad"
                            ? "border-purple-500 bg-purple-50 text-purple-700"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Nagad
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRemainingPaymentMethod("cash");
                          setRemainingPaymentError("");
                          setRemainingTransactionId("");
                        }}
                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                          remainingPaymentMethod === "cash"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Cash
                      </button>
                    </div>

                  </div>

                  {/* bKash Summary */}
                  {remainingPaymentMethod === "bkash" && (
                    <div className="mt-5 space-y-4">
                      <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5">
                        <p className="text-sm font-bold uppercase tracking-wider text-pink-700">
                          bKash Payment Summary
                        </p>

                        <div className="mt-4 space-y-3">
                          <div className="flex justify-between gap-4">
                            <span className="text-sm text-slate-600">
                              Remaining Food Amount
                            </span>

                            <span className="font-bold text-slate-900">
                              ৳{remainingAmount.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex justify-between gap-4">
                            <span className="text-sm text-slate-600">
                              Cash-out Fee (
                              {BKASH_CASHOUT_FEE_PERCENTAGE.toFixed(
                                2
                              )}
                              %)
                            </span>

                            <span className="font-bold text-pink-700">
                              ৳
                              {calculateBkashFee(
                                remainingAmount
                              ).toFixed(2)}
                            </span>
                          </div>

                          <div className="border-t border-pink-200 pt-3">
                            <div className="flex justify-between gap-4">
                              <span className="font-bold text-slate-900">
                                Total Payable via bKash
                              </span>

                              <span className="text-xl font-black text-pink-700">
                                ৳
                                {calculateBkashTotal(
                                  remainingAmount
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 text-xs leading-5 text-slate-500">
                          1.85% cash-out fee is calculated on the
                          remaining discounted food amount. The fee is
                          paid by the student and is not added to the
                          order balance.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-pink-200 bg-white p-5">
                        <p className="text-sm font-bold uppercase tracking-wider text-pink-700">
                          How to pay with bKash
                        </p>

                        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                          <p>
                            <span className="font-black text-pink-700">
                              1.
                            </span>{" "}
                            Open your bKash app or use the available
                            bKash payment service.
                          </p>

                          <p>
                            <span className="font-black text-pink-700">
                              2.
                            </span>{" "}
                            Send the{" "}
                            <strong>
                              exact Total Payable
                            </strong>{" "}
                            shown above to the cafe&apos;s bKash
                            number.
                          </p>

                          <p>
                            <span className="font-black text-pink-700">
                              3.
                            </span>{" "}
                            Complete the payment and keep the
                            confirmation message.
                          </p>

                          <p>
                            <span className="font-black text-pink-700">
                              4.
                            </span>{" "}
                            Enter the bKash Transaction ID below.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
                          Send Money To
                        </p>

                        <p className="mt-2 break-all text-2xl font-black text-slate-950">
                          {cafe?.bkash_number ||
                            "bKash number unavailable"}
                        </p>

                        {cafe?.bkash_number ? (
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            Send exactly ৳
                            {calculateBkashTotal(
                              remainingAmount
                            ).toFixed(2)}{" "}
                            to this number.
                          </p>
                        ) : (
                          <p className="mt-2 text-xs leading-5 text-red-600">
                            Cafe bKash number is not available.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Nagad */}
                  {remainingPaymentMethod === "nagad" && (
                    <div className="mt-5 rounded-xl border border-purple-200 bg-purple-50 p-4">
                      <p className="font-bold text-purple-800">
                        Nagad Remaining Payment
                      </p>

                      <p className="mt-2 text-sm leading-6 text-purple-700">
                        Student will pay ৳
                        {remainingAmount.toFixed(2)}{" "}
                        as the remaining food amount.
                      </p>
                    </div>
                  )}

                  {/* Cash */}
                  {remainingPaymentMethod === "cash" && (
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="font-bold text-emerald-800">
                        Cash Remaining Payment
                      </p>

                      <p className="mt-2 text-sm leading-6 text-emerald-700">
                        Student will pay ৳
                        {remainingAmount.toFixed(2)}{" "}
                        in cash at pickup.
                      </p>

                      <p className="mt-2 text-xs leading-5 text-emerald-700">
                        No bKash cash-out fee is added to cash
                        payment.
                      </p>
                    </div>
                  )}

                  {/* Transaction ID */}
                  {(remainingPaymentMethod === "bkash" ||
                    remainingPaymentMethod === "nagad") && (
                    <div className="mt-5">
                      <label
                        htmlFor="remainingTransactionId"
                        className="mb-2 block text-sm font-bold text-slate-700"
                      >
                        {remainingPaymentMethod === "bkash"
                          ? "bKash Transaction ID"
                          : "Nagad Transaction ID"}
                      </label>

                      <input
                        id="remainingTransactionId"
                        type="text"
                        value={remainingTransactionId}
                        onChange={(event) =>
                          setRemainingTransactionId(
                            event.target.value
                          )
                        }
                        placeholder={`Enter ${remainingPaymentMethod} Transaction ID`}
                        disabled={
                          submittingRemainingPayment
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100"
                      />
                    </div>
                  )}

                  {remainingPaymentError && (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                      {remainingPaymentError}
                    </div>
                  )}

                  {remainingPaymentMessage && (
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
                      {remainingPaymentMessage}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={submitRemainingPayment}
                    disabled={
                      submittingRemainingPayment ||
                      (remainingPaymentMethod === "bkash" &&
                        !cafe?.bkash_number)
                    }
                    className="mt-6 w-full rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingRemainingPayment
                      ? "Submitting remaining payment..."
                      : "Submit Remaining Payment"}
                  </button>
                </>
              )}
            </section>
          )}

          {/* Refund Secret Code */}
          {refundSecretCode &&
            advanceStatus !== "refunded" && (
              <div className="mt-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-5">
                <p className="text-sm font-bold uppercase tracking-wider text-indigo-700">
                  Refund Secret Code
                </p>

                <p className="mt-2 text-sm leading-6 text-indigo-700">
                  Keep this 6-character code private. It is required
                  when the shopkeeper processes your refund.
                </p>

                <div className="mt-4 rounded-xl bg-white px-5 py-4 text-center shadow-sm">
                  <p className="font-mono text-3xl font-black tracking-[0.35em] text-indigo-700">
                    {refundSecretCode}
                  </p>
                </div>
              </div>
            )}

          {/* Refund History */}
          {advanceStatus === "refunded" &&
            refundHistory.length > 0 && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="font-black text-emerald-800">
                  Refund History
                </p>

                <p className="mt-2 text-sm leading-6 text-emerald-700">
                  The Refund Secret Code is hidden after a
                  successful refund because the code is single-use
                  and must not remain reusable.
                </p>

                {refundHistory.map((refund, index) => (
                  <div
                    key={`${refund.refunded_at}-${index}`}
                    className="mt-4 space-y-3 rounded-xl bg-white p-4"
                  >
                    <div className="flex justify-between gap-4">
                      <span className="text-sm text-slate-500">
                        Refund Amount
                      </span>

                      <span className="font-bold text-slate-900">
                        ৳{Number(refund.amount).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-sm text-slate-500">
                        Refund Method
                      </span>

                      <span className="font-bold text-slate-900">
                        {refund.refund_method ||
                          "Not available"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-sm text-slate-500">
                        bKash cash-out fee
                      </span>

                      <span className="font-bold text-slate-900">
                        ৳{Number(refund.cashout_fee_amount || 0).toFixed(2)}
                      </span>
                    </div>

                    {refund.refund_method === "bkash" && (
                      <div className="flex justify-between gap-4">
                        <span className="text-sm text-slate-500">
                          Refund TrxID
                        </span>

                        <span className="break-all text-right font-bold text-slate-900">
                          {refund.refund_transaction_id ||
                            "Not available"}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between gap-4">
                      <span className="text-sm text-slate-500">
                        Refunded At
                      </span>

                      <span className="text-right text-sm font-semibold text-slate-700">
                        {new Date(
                          refund.refunded_at
                        ).toLocaleString()}
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
                {new Date(
                  order.created_at
                ).toLocaleString()}
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
              onClick={() =>
                router.push("/student/orders")
              }
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
