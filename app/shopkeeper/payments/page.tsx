"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PendingPayment = {
  payment_id: string;
  order_id: string;
  cafe_id: string;
  token_code: string;
  amount: number;
  payment_method: string;
  transaction_id: string;
  submitted_at: string;
};

type RefundPayment = {
  payment_id: string;
  order_id: string;
  cafe_id: string;
  token_code: string;
  amount: number;
  payment_method: string;
  transaction_id: string;
};

type RefundHistory = {
  history_id: string;
  payment_id: string;
  order_id: string;
  cafe_id: string;
  student_id: string;
  amount: number;
  payment_method: string;
  transaction_id: string;
  refunded_by: string;
  refunded_at: string;
  token_code: string;
  order_status: string;
};

const supabase = createClient();

function formatPaymentMethod(method: string) {
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

export default function ShopkeeperPaymentsPage() {
  const [payments, setPayments] = useState<PendingPayment[]>(
    []
  );

  const [refunds, setRefunds] = useState<RefundPayment[]>(
    []
  );

  const [history, setHistory] = useState<RefundHistory[]>(
    []
  );

  const [loading, setLoading] = useState(true);

  const [refundLoading, setRefundLoading] =
    useState(true);

  const [historyLoading, setHistoryLoading] =
    useState(true);

  const [search, setSearch] = useState("");

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [verifyingId, setVerifyingId] =
    useState<string | null>(null);

  const [refundingId, setRefundingId] =
    useState<string | null>(null);

  async function loadPayments() {
    const { data, error } = await supabase.rpc(
      "get_pending_advance_payments"
    );

    if (error) {
      setError(error.message);
      setPayments([]);
    } else {
      setPayments(data || []);
    }

    setLoading(false);
  }

  async function loadRefunds() {
    const { data, error } = await supabase.rpc(
      "get_pending_refund_payments"
    );

    if (error) {
      setError(error.message);
      setRefunds([]);
    } else {
      setRefunds(data || []);
    }

    setRefundLoading(false);
  }

  async function loadHistory() {
    const { data, error } = await supabase.rpc(
      "get_shopkeeper_refund_history"
    );

    if (error) {
      setError(error.message);
      setHistory([]);
    } else {
      setHistory(data || []);
    }

    setHistoryLoading(false);
  }

  async function verifyPayment(paymentId: string) {
    const confirmVerify = window.confirm(
      "আপনি কি এই payment verify করতে চান?"
    );

    if (!confirmVerify) {
      return;
    }

    setVerifyingId(paymentId);
    setMessage("");
    setError("");

    const { error } = await supabase.rpc(
      "verify_advance_payment",
      {
        p_payment_id: paymentId,
      }
    );

    if (error) {
      setError(error.message);
    } else {
      setMessage("Payment successfully verified.");

      await loadPayments();
    }

    setVerifyingId(null);
  }

  async function refundPayment(paymentId: string) {
    const confirmRefund = window.confirm(
      "আপনি কি এই payment-এর refund সম্পন্ন হয়েছে হিসেবে mark করতে চান?"
    );

    if (!confirmRefund) {
      return;
    }

    setRefundingId(paymentId);
    setMessage("");
    setError("");

    const { error } = await supabase.rpc(
      "refund_advance_payment",
      {
        p_payment_id: paymentId,
      }
    );

    if (error) {
      setError(error.message);
    } else {
      setMessage("Refund successfully recorded.");

      await loadRefunds();
      await loadHistory();

      const { error: emailError } =
        await supabase.functions.invoke(
          "send-refund-email",
          {
            body: {
              payment_id: paymentId,
            },
          }
        );

      if (emailError) {
        console.error(
          "Refund email error:",
          emailError
        );
      }
    }

    setRefundingId(null);
  }

  async function refreshAll() {
    setLoading(true);
    setRefundLoading(true);
    setHistoryLoading(true);

    setMessage("");
    setError("");

    await Promise.all([
      loadPayments(),
      loadRefunds(),
      loadHistory(),
    ]);
  }

  useEffect(() => {
    refreshAll();
  }, []);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return payments;
    }

    return payments.filter((payment) => {
      return (
        payment.token_code
          ?.toLowerCase()
          .includes(query) ||
        payment.transaction_id
          ?.toLowerCase()
          .includes(query) ||
        payment.order_id
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [payments, search]);

  const filteredRefunds = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return refunds;
    }

    return refunds.filter((refund) => {
      return (
        refund.token_code
          ?.toLowerCase()
          .includes(query) ||
        refund.transaction_id
          ?.toLowerCase()
          .includes(query) ||
        refund.order_id
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [refunds, search]);

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return history;
    }

    return history.filter((item) => {
      return (
        item.token_code
          ?.toLowerCase()
          .includes(query) ||
        item.transaction_id
          ?.toLowerCase()
          .includes(query) ||
        item.order_id
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [history, search]);

  const totalSearchResults =
    filteredPayments.length +
    filteredRefunds.length +
    filteredHistory.length;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
              SHOPKEEPER
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Payment Verification
            </h1>

            <p className="mt-2 text-slate-600">
              Payment verify করুন, refund manage করুন এবং
              completed refund history দেখুন।
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={refreshAll}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>

            <button
              onClick={() =>
                (window.location.href = "/shopkeeper")
              }
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Dashboard
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="w-full">
              <label
                htmlFor="paymentSearch"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Search Payment
              </label>

              <input
                id="paymentSearch"
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Token / Transaction ID / Order ID"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Showing {totalSearchResults} matching payment records
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <section>
          <h2 className="mb-4 text-2xl font-bold text-slate-900">
            Pending Advance Payments
          </h2>

          {loading ? (
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              Loading payments...
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">
                No pending payments
              </h3>

              <p className="mt-2 text-slate-500">
                Search অনুযায়ী কোনো pending payment নেই।
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredPayments.map((payment) => (
                <div
                  key={payment.payment_id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-500">
                        Order Token
                      </p>

                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {payment.token_code}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Amount
                      </p>

                      <p className="mt-1 text-xl font-bold text-emerald-600">
                        ৳{Number(payment.amount).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Payment Method
                      </p>

                      <p className="mt-1 font-semibold text-slate-900">
                        {formatPaymentMethod(
                          payment.payment_method
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Transaction ID
                      </p>

                      <p className="mt-1 break-all font-semibold text-slate-900">
                        {payment.transaction_id}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      verifyPayment(
                        payment.payment_id
                      )
                    }
                    disabled={
                      verifyingId === payment.payment_id
                    }
                    className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {verifyingId === payment.payment_id
                      ? "Verifying..."
                      : "Verify Payment"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">
            Refund Pending
          </h2>

          {refundLoading ? (
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              Loading refunds...
            </div>
          ) : filteredRefunds.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">
                No pending refunds
              </h3>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredRefunds.map((refund) => (
                <div
                  key={refund.payment_id}
                  className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm"
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-500">
                        Order Token
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {refund.token_code}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Refund Amount
                      </p>

                      <p className="mt-1 text-xl font-bold text-orange-600">
                        ৳{Number(refund.amount).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Original Payment Method
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatPaymentMethod(
                          refund.payment_method
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Original Transaction ID
                      </p>

                      <p className="mt-1 break-all font-semibold">
                        {refund.transaction_id}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl bg-orange-50 p-4 text-sm leading-6 text-orange-700">
                    Refund বাস্তবে সম্পন্ন করার পরই
                    <strong> Mark Refund Completed </strong>
                    চাপবেন।
                  </div>

                  <button
                    onClick={() =>
                      refundPayment(
                        refund.payment_id
                      )
                    }
                    disabled={
                      refundingId === refund.payment_id
                    }
                    className="mt-5 rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {refundingId === refund.payment_id
                      ? "Updating..."
                      : "Mark Refund Completed"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">
            Completed Refund History
          </h2>

          {historyLoading ? (
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              Loading refund history...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">
                No completed refunds yet
              </h3>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((item) => (
                <div
                  key={item.history_id}
                  className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-500">
                        Token
                      </p>

                      <p className="mt-1 text-lg font-bold">
                        {item.token_code}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Refund Amount
                      </p>

                      <p className="mt-1 text-lg font-bold text-emerald-600">
                        ৳{Number(item.amount).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Original Payment Method
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatPaymentMethod(
                          item.payment_method
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Original Transaction ID
                      </p>

                      <p className="mt-1 break-all font-bold">
                        {item.transaction_id}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Refund Date
                      </p>

                      <p className="mt-1 font-semibold">
                        {new Date(
                          item.refunded_at
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                    Refund completed ✓
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}