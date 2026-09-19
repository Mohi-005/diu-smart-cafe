"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  token_code: string;
  status: string;
  total_amount: number;
  created_at: string;
};

function formatStatus(status: string) {
  switch (status) {
    case "payment_pending":
      return "Payment Verification Pending";

    case "confirmed":
      return "Confirmed";

    case "preparing":
      return "Preparing";

    case "ready":
      return "Ready for Pickup";

    case "collected":
      return "Collected";

    case "cancelled":
      return "Cancelled";

    default:
      return status.replaceAll("_", " ");
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case "payment_pending":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "confirmed":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "preparing":
      return "border-purple-200 bg-purple-50 text-purple-700";

    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "collected":
      return "border-slate-200 bg-slate-100 text-slate-700";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

export default function StudentOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const loadOrders = useCallback(async () => {
    setError("");

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (profile?.role !== "student") {
      router.replace("/student");
      return;
    }

    const { data, error: ordersError } = await supabase
      .from("orders")
      .select(
        "id, token_code, status, total_amount, created_at"
      )
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });

    if (ordersError) {
      setError(ordersError.message);
    } else {
      setOrders(data || []);
    }

    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleRefresh() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    await loadOrders();
  }

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !query ||
        order.token_code
          ?.toLowerCase()
          .includes(query) ||
        order.id
          ?.toLowerCase()
          .includes(query) ||
        formatStatus(order.status)
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
              Student
            </span>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              My Orders
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
              View your complete order history and current order status.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              )}

              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <Link
              href="/student"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5"
          >
            <p className="font-bold text-red-800">
              Unable to load your orders
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />

            <p className="mt-4 text-sm font-medium text-slate-500">
              Loading your orders...
            </p>
          </div>
        ) : orders.length === 0 ? (
          /* Empty State */
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-5xl">
              📦
            </div>

            <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-950">
              No orders yet
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
              Your order history will appear here after you place your
              first order.
            </p>

            <Link
              href="/menu"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Browse Menu
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <>
            {/* Search and Filter */}
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                <div>
                  <label
                    htmlFor="orderSearch"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    Search Orders
                  </label>

                  <input
                    id="orderSearch"
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Token code / Order ID / Status"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="statusFilter"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    Filter by Status
                  </label>

                  <select
                    id="statusFilter"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="all">
                      All Orders
                    </option>

                    <option value="payment_pending">
                      Payment Pending
                    </option>

                    <option value="confirmed">
                      Confirmed
                    </option>

                    <option value="preparing">
                      Preparing
                    </option>

                    <option value="ready">
                      Ready for Pickup
                    </option>

                    <option value="collected">
                      Collected
                    </option>

                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Showing{" "}
                  <span className="font-bold text-slate-700">
                    {filteredOrders.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-slate-700">
                    {orders.length}
                  </span>{" "}
                  orders
                </p>

                {(search.trim() ||
                  statusFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Order List */}
            {filteredOrders.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                  🔎
                </div>

                <h2 className="mt-5 text-xl font-black text-slate-950">
                  No matching orders
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Search or status filter অনুযায়ী কোনো order পাওয়া যায়নি।
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {filteredOrders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      {/* Order Info */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-xl font-black tracking-tight text-slate-950">
                            {order.token_code}
                          </p>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                              order.status
                            )}`}
                          >
                            {formatStatus(order.status)}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                          {new Date(
                            order.created_at
                          ).toLocaleString()}
                        </p>
                      </div>

                      {/* Order Actions */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-left sm:text-right">
                          <p className="text-[11px] font-medium text-slate-400">
                            Order Total
                          </p>

                          <p className="mt-0.5 text-lg font-black text-slate-950">
                            ৳
                            {Number(
                              order.total_amount
                            ).toFixed(2)}
                          </p>
                        </div>

                        <Link
                          href={`/order/${order.id}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          View Order
                          <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}