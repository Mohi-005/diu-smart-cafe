"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OrderType = "preorder" | "instant";

type AdvancePaymentFormProps = {
  orderId: string;
  amount: number;
  paymentStatus: string;
  orderType?: OrderType;
};

export default function AdvancePaymentForm({
  orderId,
  amount,
  paymentStatus,
  orderType = "preorder",
}: AdvancePaymentFormProps) {
  const supabase = createClient();

  const [paymentMethod, setPaymentMethod] =
    useState<"bkash" | "cash">("bkash");

  const [transactionId, setTransactionId] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  async function handleSubmit() {
    setMessage("");
    setError("");

    if (
      paymentMethod === "bkash" &&
      !transactionId.trim()
    ) {
      setError(
        "bKash payment-এর জন্য transaction ID দিতে হবে."
      );
      return;
    }

    if (
      paymentMethod === "cash" &&
      orderType !== "instant"
    ) {
      setError(
        "Cash payment শুধুমাত্র Instant Buy-এর জন্য ব্যবহার করা যাবে."
      );
      return;
    }

    setSubmitting(true);

    const {
      data,
      error: paymentError,
    } = await supabase.rpc(
      "submit_manual_payment",
      {
        p_order_id: orderId,
        p_payment_method: paymentMethod,
        p_transaction_id:
          paymentMethod === "bkash"
            ? transactionId.trim()
            : null,
      }
    );

    if (paymentError) {
      setError(paymentError.message);
      setSubmitting(false);
      return;
    }

    const result =
      data && typeof data === "object"
        ? (data as {
            payment_status?: string;
            order_status?: string;
            order_type?: string;
          })
        : null;

    if (paymentMethod === "cash") {
      setMessage(
        "Cash payment successfully recorded. Your Instant Buy order is now confirmed."
      );
    } else {
      setMessage(
        orderType === "instant"
          ? "Full payment submitted successfully. Shopkeeper verification is required before preparation."
          : "Advance payment submitted successfully. Shopkeeper verification is required."
      );
    }

    /*
     * Small delay so the user can see the success message.
     */
    setTimeout(() => {
      window.location.href = `/order/${orderId}`;
    }, 1400);

    void result;

    setSubmitting(false);
  }

  if (
    paymentStatus === "paid" ||
    paymentStatus === "submitted"
  ) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        {paymentStatus === "paid" ? (
          <>
            <p className="font-bold text-emerald-700">
              Payment Verified ✓
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {orderType === "instant"
                ? "Your full payment has been completed and the Instant Buy order is confirmed."
                : "Your payment has already been verified."}
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-amber-700">
              Payment Verification Pending
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {orderType === "instant"
                ? "Your full payment has been submitted and is waiting for shopkeeper verification."
                : "Your advance payment has been submitted and is waiting for shopkeeper verification."}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
            {orderType === "instant"
              ? "Instant Buy Payment"
              : "Advance Payment"}
          </p>

          <h3 className="mt-1 text-2xl font-black text-slate-950">
            ৳{Number(amount).toFixed(2)}
          </h3>
        </div>
      </div>

      {orderType === "instant" && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm leading-6 text-blue-800">
            Instant Buy-এর জন্য পুরো amount এখনই pay করতে হবে।
          </p>
        </div>
      )}

      {orderType === "preorder" && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm leading-6 text-emerald-800">
            Pre-order-এর জন্য এখন 50% advance payment দিতে হবে।
            বাকি amount খাবার ready হলে দিতে হবে।
          </p>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-3 text-sm font-bold text-slate-700">
          Payment Method
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setPaymentMethod("bkash");
              setError("");
            }}
            className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
              paymentMethod === "bkash"
                ? "border-pink-500 bg-pink-50 text-pink-700"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            bKash
          </button>

          {orderType === "instant" && (
            <button
              type="button"
              onClick={() => {
                setPaymentMethod("cash");
                setError("");
              }}
              className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                paymentMethod === "cash"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              Cash
            </button>
          )}
        </div>
      </div>

      {paymentMethod === "bkash" && (
        <div className="mt-5">
          <label
            htmlFor="transactionId"
            className="mb-2 block text-sm font-bold text-slate-700"
          >
            bKash Transaction ID
          </label>

          <input
            id="transactionId"
            type="text"
            value={transactionId}
            onChange={(event) =>
              setTransactionId(event.target.value)
            }
            placeholder="Enter bKash TrxID"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-100"
          />

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Payment করার পরে bKash থেকে পাওয়া Transaction ID এখানে
            লিখুন।
          </p>
        </div>
      )}

      {paymentMethod === "cash" &&
        orderType === "instant" && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm leading-6 text-amber-800">
              Cash payment select করলে order instantly
              confirmed হবে।
            </p>
          </div>
        )}

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
          {message}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? "Submitting payment..."
          : paymentMethod === "cash"
            ? "Confirm Cash Payment"
            : orderType === "instant"
              ? "Submit Full Payment"
              : "Submit Advance Payment"}
      </button>
    </div>
  );
}