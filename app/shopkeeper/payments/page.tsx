"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RefundPayment = {
  payment_id: string;
  order_id: string;
  cafe_id: string;
  token_code: string;
  amount: number;
  payment_method: string;
  transaction_id: string | null;
};

const supabase = createClient();

export default function ShopkeeperPaymentsPage() {
  const [refunds, setRefunds] = useState<
    RefundPayment[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [refundSecret, setRefundSecret] =
    useState<Record<string, string>>({});

  const [refundMethod, setRefundMethod] =
    useState<Record<string, string>>({});

  const [refundTransactionId, setRefundTransactionId] =
    useState<Record<string, string>>({});

  async function loadRefunds() {
    setLoading(true);
    setError("");

    const { data, error: refundError } =
      await supabase.rpc(
        "get_pending_refund_payments_v2"
      );

    if (refundError) {
      setError(refundError.message);
      setRefunds([]);
    } else {
      setRefunds(
        Array.isArray(data)
          ? (data as RefundPayment[])
          : []
      );
    }

    setLoading(false);
  }

  async function processRefund(
    refund: RefundPayment
  ) {
    const originalTransactionId =
      refund.transaction_id?.trim() || "";

    const secret =
      refundSecret[refund.payment_id]
        ?.trim()
        .toUpperCase() || "";

    const method =
      refundMethod[refund.payment_id] || "";

    const newRefundTransactionId =
      refundTransactionId[
        refund.payment_id
      ]?.trim() || "";

    if (!originalTransactionId) {
      setError(
        "Original payment transaction ID পাওয়া যায়নি।"
      );
      return;
    }

    if (!secret) {
      setError(
        "Student-এর 6-character refund secret code দিন।"
      );
      return;
    }

    if (!method) {
      setError(
        "Refund method select করুন।"
      );
      return;
    }

    if (
      method === "bkash" &&
      !newRefundTransactionId
    ) {
      setError(
        "bKash refund হলে নতুন refund TrxID দিতে হবে।"
      );
      return;
    }

    if (
      method === "cash" &&
      newRefundTransactionId
    ) {
      setError(
        "Cash refund-এর ক্ষেত্রে নতুন refund TrxID দেওয়া যাবে না।"
      );
      return;
    }

    const confirmed = window.confirm(
      `Token ${refund.token_code}-এর ৳${Number(
        refund.amount
      ).toFixed(
        2
      )} refund process করবেন?`
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(refund.payment_id);
    setError("");
    setMessage("");

    const { error: rpcError } =
      await supabase.rpc(
        "process_refund_advance_payment",
        {
          p_payment_id: refund.payment_id,
          p_original_transaction_id:
            originalTransactionId,
          p_refund_code: secret,
          p_refund_method: method,
          p_refund_transaction_id:
            newRefundTransactionId || null,
        }
      );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      const { error: emailError } = await supabase.functions.invoke(
        "send-refund-email",
        { body: { payment_id: refund.payment_id } }
      );

      setMessage(
        emailError
          ? `Token ${refund.token_code}-এর refund recorded হয়েছে। Email notification পাঠানো যায়নি; আবার চেষ্টা করুন।`
          : `Token ${refund.token_code}-এর refund successfully recorded এবং student-কে email পাঠানো হয়েছে।`
      );

      setRefundSecret((prev) => {
        const next = { ...prev };
        delete next[refund.payment_id];
        return next;
      });

      setRefundMethod((prev) => {
        const next = { ...prev };
        delete next[refund.payment_id];
        return next;
      });

      setRefundTransactionId((prev) => {
        const next = { ...prev };
        delete next[refund.payment_id];
        return next;
      });

      await loadRefunds();
    }

    setProcessingId(null);
  }

  useEffect(() => {
    loadRefunds();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
              SHOPKEEPER
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Refund Management
            </h1>

            <p className="mt-2 text-slate-600">
              Student cancellation-এর পরে শুধু verified refund request
              secure verification-এর মাধ্যমে process করুন।
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadRefunds}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={() =>
                (window.location.href = "/shopkeeper")
              }
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Dashboard
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section>
          <div className="mb-5">
            <p className="text-sm font-bold uppercase tracking-wider text-orange-600">
              Secure Refund Queue
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Open Refund Requests
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Original TrxID এবং student-এর refund secret code verify না হলে
              refund process হবে না।
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              Loading refunds...
            </div>
          ) : refunds.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <h3 className="text-xl font-bold text-slate-900">
                No pending refunds
              </h3>

              <p className="mt-2 text-slate-500">
                এখন কোনো refund pending নেই।
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {refunds.map((refund) => {
                const method =
                  refundMethod[
                    refund.payment_id
                  ] || "";

                return (
                  <article
                    key={refund.payment_id}
                    className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm"
                  >
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-slate-500">
                          Order Token
                        </p>

                        <p className="mt-1 text-2xl font-black text-slate-950">
                          {refund.token_code}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-slate-500">
                          Refund Amount
                        </p>

                        <p className="mt-1 text-2xl font-black text-orange-600">
                          ৳
                          {Number(
                            refund.amount
                          ).toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-slate-500">
                          Original Payment Method
                        </p>

                        <p className="mt-1 font-bold text-slate-900">
                          {refund.payment_method}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-slate-500">
                          Original Transaction ID
                        </p>

                        <p className="mt-1 break-all font-bold text-slate-900">
                          {refund.transaction_id ||
                            "Not available"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="font-bold text-blue-800">
                        Secure verification required
                      </p>

                      <p className="mt-2 text-sm leading-6 text-blue-700">
                        Student থেকে পাওয়া 6-character refund secret code
                        এখানে দিন। Original TrxID system-এর stored value-এর
                        সাথে automatically verify হবে।
                      </p>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      {/* Secret */}
                      <div>
                        <label
                          htmlFor={`refund-secret-${refund.payment_id}`}
                          className="mb-2 block text-sm font-bold text-slate-700"
                        >
                          Refund Secret
                        </label>

                        <input
                          id={`refund-secret-${refund.payment_id}`}
                          type="text"
                          maxLength={6}
                          value={
                            refundSecret[
                              refund.payment_id
                            ] || ""
                          }
                          onChange={(event) =>
                            setRefundSecret(
                              (prev) => ({
                                ...prev,
                                [refund.payment_id]:
                                  event.target.value
                                    .toUpperCase()
                                    .replace(
                                      /[^A-Z0-9]/g,
                                      ""
                                    )
                                    .slice(0, 6),
                              })
                            )
                          }
                          placeholder="6-character code"
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                        />
                      </div>

                      {/* Refund method */}
                      <div>
                        <label
                          htmlFor={`refund-method-${refund.payment_id}`}
                          className="mb-2 block text-sm font-bold text-slate-700"
                        >
                          Refund Method
                        </label>

                        <select
                          id={`refund-method-${refund.payment_id}`}
                          value={method}
                          onChange={(event) =>
                            setRefundMethod(
                              (prev) => ({
                                ...prev,
                                [refund.payment_id]:
                                  event.target.value,
                              })
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                        >
                          <option value="">
                            Select method
                          </option>

                          <option value="cash">
                            Cash
                          </option>

                          <option value="bkash">
                            bKash
                          </option>
                        </select>
                      </div>

                      {/* New refund TrxID */}
                      <div>
                        <label
                          htmlFor={`refund-trx-${refund.payment_id}`}
                          className="mb-2 block text-sm font-bold text-slate-700"
                        >
                          New Refund TrxID
                        </label>

                        <input
                          id={`refund-trx-${refund.payment_id}`}
                          type="text"
                          value={
                            refundTransactionId[
                              refund.payment_id
                            ] || ""
                          }
                          onChange={(event) =>
                            setRefundTransactionId(
                              (prev) => ({
                                ...prev,
                                [refund.payment_id]:
                                  event.target.value,
                              })
                            )
                          }
                          disabled={method !== "bkash"}
                          placeholder={
                            method === "bkash"
                              ? "bKash refund TrxID"
                              : "Not required for cash"
                          }
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition disabled:bg-slate-100 disabled:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                        />
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl bg-orange-50 p-4 text-sm leading-6 text-orange-700">
                      <strong>Cash:</strong> New refund TrxID লাগবে না।
                      <br />
                      <strong>bKash:</strong> New refund TrxID অবশ্যই দিতে হবে।
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        processRefund(refund)
                      }
                      disabled={
                        processingId ===
                        refund.payment_id
                      }
                      className="mt-5 w-full rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {processingId ===
                      refund.payment_id
                        ? "Processing Refund..."
                        : "Verify & Complete Refund"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
