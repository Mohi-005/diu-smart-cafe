"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type HistoryOrder = {
  order_id: string;
  token_code: string;
  cafe_id: string;
  status: string;
  total_amount: number;
  created_at: string;
  student_name: string | null;
  student_phone: string | null;
  advance_payment_status: string | null;
  remaining_payment_status: string | null;
  refund_status: string | null;
};

const supabase = createClient();

function formatStatus(status: string) {
  switch (status) {
    case "collected":
      return "Collected";
    case "cancelled":
      return "Cancelled";
    default:
      return status.replaceAll("_", " ");
  }
}

function formatPaymentStatus(status?: string | null) {
  if (!status) return "Not available";
  if (status === "paid") return "Paid";
  if (status === "submitted") return "Submitted";
  if (status === "refund_pending") return "Refund Pending";
  if (status === "refunded") return "Refunded";
  if (status === "unpaid") return "Unpaid";
  if (status === "not_required") return "Not Required";
  return status.replaceAll("_", " ");
}

export default function ShopkeeperOrderHistoryPage() {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadHistory() {
    setError("");

    const { data, error: rpcError } = await supabase.rpc(
      "get_shopkeeper_order_history_v1"
    );

    if (rpcError) {
      setError(rpcError.message);
      setOrders([]);
      return;
    }

    setOrders(
      Array.isArray(data)
        ? (data as HistoryOrder[])
        : []
    );
  }

  useEffect(() => {
    async function initialLoad() {
      setLoading(true);
      await loadHistory();
      setLoading(false);
    }

    void initialLoad();
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return orders;
    }

    return orders.filter((order) =>
      [
        order.token_code,
        order.student_name,
        order.student_phone,
        order.order_id,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [orders, search]);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
              SHOPKEEPER
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Order History
            </h1>

            <p className="mt-2 text-slate-600">
              Collected এবং cancelled orders এখানে থাকবে। Token, student name
              বা phone number দিয়ে খুঁজতে পারবেন।
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Refresh
            </button>

            <Link
              href="/shopkeeper/orders"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Active Orders
            </Link>

            <Link
              href="/shopkeeper"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label
            htmlFor="shopkeeper-history-search"
            className="mb-2 block text-sm font-bold text-slate-700"
          >
            Search History
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="shopkeeper-history-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Token, student name বা phone number"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />

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
            Showing {filteredOrders.length} of {orders.length} history orders
          </p>
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            Loading order history...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold">No history orders found</h2>

            <p className="mt-2 text-slate-500">
              Matching collected or cancelled orders will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredOrders.map((order) => (
              <article
                key={order.order_id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Token
                    </p>
                    <p className="mt-1 text-xl font-black text-slate-950">
                      {order.token_code}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Status
                    </p>
                    <p
                      className={`mt-1 font-black ${
                        order.status === "collected"
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatStatus(order.status)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Student
                    </p>
                    <p className="mt-1 font-bold text-slate-950">
                      {order.student_name || "Not available"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Phone
                    </p>
                    <p className="mt-1 font-bold text-slate-950">
                      {order.student_phone || "Not available"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Total
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      ৳{Number(order.total_amount).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Created
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Advance Payment</p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatPaymentStatus(order.advance_payment_status)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Remaining Payment</p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatPaymentStatus(order.remaining_payment_status)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Refund Status</p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatPaymentStatus(order.refund_status)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
