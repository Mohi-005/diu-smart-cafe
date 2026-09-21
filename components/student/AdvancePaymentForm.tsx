"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OrderType = "preorder" | "instant";

type AdvancePaymentFormProps = {
  orderId: string;
  amount: number;
  paymentStatus: string;
  orderType?: OrderType;
  bkashNumber?: string | null;
  cashoutFeePercentage?: number;
};

type PaymentResult = {
  payment_status?: string;
  order_status?: string;
  order_type?: string;
  amount?: number;
  cashout_fee_amount?: number;
  charged_amount?: number;
};

export default function AdvancePaymentForm({
  orderId,
  amount,
  paymentStatus,
  orderType = "preorder",
  bkashNumber = null,
  cashoutFeePercentage = 1.85,
}: AdvancePaymentFormProps) {
  const supabase = createClient();

  const [paymentMethod, setPaymentMethod] =
    useState<"bkash" | "cash">("bkash");

  const [transactionId, setTransactionId] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const safeAmount = Number(amount) || 0;

  const safeCashoutFeePercentage =
    Number(cashoutFeePercentage) || 0;

  const bkashCashoutFee =
    Math.round(
      safeAmount *
        (safeCashoutFeePercentage / 100) *
        100
    ) / 100;

  const bkashTotalPayable =
    Math.round(
      (safeAmount + bkashCashoutFee) *
        100
    ) / 100;

  async function handleSubmit() {
    setMessage("");
    setError("");

    if (
      paymentMethod === "bkash" &&
      !bkashNumber?.trim()
    ) {
      setError(
        "এই cafe-এর bKash number এখনো সেট করা হয়নি. Payment করার আগে cafe-এর bKash number সেট করতে হবে."
      );
      return;
    }

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

    const result: PaymentResult =
      data &&
      typeof data === "object"
        ? (data as PaymentResult)
        : {};

    const serverChargedAmount =
      Number(
        result.charged_amount ?? 0
      );

    const serverFee =
      Number(
        result.cashout_fee_amount ?? 0
      );

    if (paymentMethod === "cash") {
      setMessage(
        "Cash payment successfully recorded. Your Instant Buy order is now confirmed."
      );
    } else {
      const feeText =
        serverFee > 0
          ? ` bKash cash-out fee: ৳${serverFee.toFixed(
              2
            )}.`
          : "";

      const chargedText =
        serverChargedAmount > 0
          ? ` Total charged amount: ৳${serverChargedAmount.toFixed(
              2
            )}.`
          : "";

      setMessage(
        `${
          orderType === "instant"
            ? "Full bKash payment submitted successfully."
            : "Advance bKash payment submitted successfully."
        }${feeText}${chargedText} Shopkeeper verification is required.`
      );
    }

    setTimeout(() => {
      window.location.href =
        `/order/${orderId}`;
    }, 1600);

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
            ৳{safeAmount.toFixed(2)}
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
            Pre-order-এর জন্য এখন 50% advance payment দিতে হবে। বাকি amount খাবার ready হলে দিতে হবে।
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
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5">
            <p className="text-sm font-bold uppercase tracking-wider text-pink-700">
              bKash Payment Summary
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-600">
                  Food / Payment Amount
                </span>

                <span className="font-bold text-slate-900">
                  ৳{safeAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-600">
                  Cash-out Fee (
                  {safeCashoutFeePercentage.toFixed(2)}%)
                </span>

                <span className="font-bold text-pink-700">
                  ৳{bkashCashoutFee.toFixed(2)}
                </span>
              </div>

              <div className="border-t border-pink-200 pt-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold text-slate-900">
                    Total Payable via bKash
                  </span>

                  <span className="text-xl font-black text-pink-700">
                    ৳{bkashTotalPayable.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              1.85% cash-out fee is calculated on the final discounted payment amount, not the original menu price. The cafe receives the full food/payment amount.
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
                Open your bKash app or dial the bKash USSD service.
              </p>

              <p>
                <span className="font-black text-pink-700">
                  2.
                </span>{" "}
                Send the{" "}
                <strong>
                  exact Total Payable
                </strong>{" "}
                shown above to the cafe&apos;s bKash number.
              </p>

              <p>
                <span className="font-black text-pink-700">
                  3.
                </span>{" "}
                Complete the payment and keep the bKash confirmation message.
              </p>

              <p>
                <span className="font-black text-pink-700">
                  4.
                </span>{" "}
                Enter the bKash Transaction ID below and submit the payment record.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Send Money To
            </p>

            <p className="mt-2 break-all text-2xl font-black text-slate-950">
              {bkashNumber ||
                "bKash number unavailable"}
            </p>

            {bkashNumber ? (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Send exactly ৳
                {bkashTotalPayable.toFixed(2)}
                {" "}
                to this number. Keep the transaction ID until your payment is verified.
              </p>
            ) : (
              <p className="mt-2 text-xs leading-5 text-red-600">
                Cafe bKash number is not available right now. Please contact the cafe before making payment.
              </p>
            )}
          </div>

          <div>
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
              Payment করার পরে bKash থেকে পাওয়া Transaction ID এখানে লিখুন।
            </p>
          </div>
        </div>
      )}

      {paymentMethod === "cash" &&
        orderType === "instant" && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm leading-6 text-amber-800">
              Cash payment select করলে order instantly confirmed হবে।
            </p>

            <div className="mt-3 border-t border-amber-200 pt-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-amber-700">
                  Total Payable
                </span>

                <span className="font-black text-amber-900">
                  ৳{safeAmount.toFixed(2)}
                </span>
              </div>

              <p className="mt-1 text-xs text-amber-700">
                Cash payment-এর জন্য কোনো bKash cash-out fee নেই।
              </p>
            </div>
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
        disabled={
          submitting ||
          (
            paymentMethod === "bkash" &&
            !bkashNumber
          )
        }
        className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? "Submitting payment..."
          : paymentMethod === "cash"
            ? "Confirm Cash Payment"
            : orderType === "instant"
              ? "Submit Full bKash Payment"
              : "Submit Advance bKash Payment"}
      </button>
    </div>
  );
}
