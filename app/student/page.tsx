"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Order = {
  id: string;
  token_code: string;
  status: string;
  total_amount: number;
  created_at: string;
  cancellation_deadline_at: string | null;
  cafe_id: string;
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
};

function formatOrderStatus(status: string) {
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
      return status;
  }
}

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(seconds, 0);

  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function StudentPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] =
    useState<Order | null>(null);
  const [currentCafe, setCurrentCafe] =
    useState<Cafe | null>(null);
  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [cancelSeconds, setCancelSeconds] =
    useState(0);
  const [cancelling, setCancelling] =
    useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  async function loadDashboard() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    setEmail(user.email ?? "");

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      router.replace("/login");
      return;
    }

    if (profile?.role === "shopkeeper") {
      router.replace("/shopkeeper");
      return;
    }

    if (profile?.role === "admin") {
      router.replace("/");
      return;
    }

    if (profile?.role !== "student") {
      router.replace("/login");
      return;
    }

    const {
      data: ordersData,
      error: ordersError,
    } = await supabase
      .from("orders")
      .select(
        "id, token_code, status, total_amount, created_at, cancellation_deadline_at, cafe_id"
      )
      .eq("student_id", user.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(20);

    if (ordersError) {
      console.error(ordersError);
      setLoading(false);
      return;
    }

    const allOrders = ordersData ?? [];

    setOrders(allOrders);

    const activeOrder =
      allOrders.find(
        (order) =>
          order.status !== "cancelled" &&
          order.status !== "collected"
      ) ?? null;

    setCurrentOrder(activeOrder);

    if (activeOrder) {
      const [
        cafeResult,
        paymentResult,
      ] = await Promise.all([
        supabase
          .from("cafes")
          .select("id, name")
          .eq("id", activeOrder.cafe_id)
          .maybeSingle(),

        supabase
          .from("payments")
          .select(
            "id, payment_stage, amount, status"
          )
          .eq("order_id", activeOrder.id),
      ]);

      setCurrentCafe(cafeResult.data ?? null);
      setPayments(paymentResult.data ?? []);
    } else {
      setCurrentCafe(null);
      setPayments([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, [router]);

  useEffect(() => {
    if (
      !currentOrder?.cancellation_deadline_at
    ) {
      setCancelSeconds(0);
      return;
    }

    function updateCountdown() {
      const deadline = new Date(
        currentOrder!.cancellation_deadline_at!
      ).getTime();

      const remaining = Math.max(
        0,
        Math.floor(
          (deadline - Date.now()) / 1000
        )
      );

      setCancelSeconds(remaining);
    }

    updateCountdown();

    const timer = window.setInterval(
      updateCountdown,
      1000
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [currentOrder?.cancellation_deadline_at]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleCancelOrder() {
    if (!currentOrder || cancelling) {
      return;
    }

    if (cancelSeconds <= 0) {
      return;
    }

    const confirmed = window.confirm(
      "আপনি কি এই order বাতিল করতে চান?"
    );

    if (!confirmed) {
      return;
    }

    setCancelling(true);

    const {
      data,
      error,
    } = await supabase.rpc(
      "cancel_student_order",
      {
        p_order_id: currentOrder.id,
      }
    );

    if (error) {
      window.alert(error.message);
      setCancelling(false);
      return;
    }

    if (!data) {
      setCancelling(false);
      return;
    }

    await loadDashboard();

    setCancelling(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Loading dashboard...
        </p>
      </main>
    );
  }

  const advancePaid =
    payments
      .filter(
        (payment) =>
          payment.payment_stage === "advance" &&
          payment.status === "paid"
      )
      .reduce(
        (total, payment) =>
          total + Number(payment.amount),
        0
      );

  const remainingPaid =
    payments
      .filter(
        (payment) =>
          payment.payment_stage === "remaining" &&
          payment.status === "paid"
      )
      .reduce(
        (total, payment) =>
          total + Number(payment.amount),
        0
      );

  const remainingDue = currentOrder
    ? Math.max(
        Number(currentOrder.total_amount) -
          advancePaid -
          remainingPaid,
        0
      )
    : 0;

  const historyOrders = orders.filter(
    (order) => order.id !== currentOrder?.id
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredHistoryOrders = historyOrders.filter((order) => {
    if (!normalizedSearch) {
      return true;
    }

    const token = order.token_code.toLowerCase();
    const status = formatOrderStatus(order.status).toLowerCase();
    const rawStatus = order.status.toLowerCase();
    const orderId = order.id.toLowerCase();
    const amount = Number(order.total_amount)
      .toFixed(2)
      .toLowerCase();

    return (
      token.includes(normalizedSearch) ||
      status.includes(normalizedSearch) ||
      rawStatus.includes(normalizedSearch) ||
      orderId.includes(normalizedSearch) ||
      amount.includes(normalizedSearch)
    );
  });

  const cancellationAllowed =
    currentOrder &&
    currentOrder.status !== "cancelled" &&
    currentOrder.status !== "collected" &&
    cancelSeconds > 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-lg font-black tracking-tight">
              DIU{" "}
              <span className="text-emerald-600">
                Smart Cafe
              </span>
            </p>

            <p className="text-xs text-slate-500">
              Student Dashboard
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDashboard}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10">
        <section>
          <p className="text-sm font-semibold text-emerald-600">
            Welcome back
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Student Dashboard
          </h1>

          <p className="mt-2 text-slate-600">
            {email}
          </p>
        </section>

        {currentOrder ? (
          <section className="mt-8 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
                  Current Order
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {currentOrder.token_code}
                </h2>

                <p className="mt-1 text-slate-500">
                  {currentCafe?.name ?? "Cafe"}
                </p>
              </div>

              <span className="w-fit rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                {formatOrderStatus(
                  currentOrder.status
                )}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">
                  Total
                </p>

                <p className="mt-1 text-xl font-bold">
                  ৳
                  {Number(
                    currentOrder.total_amount
                  ).toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-sm text-emerald-600">
                  Advance Paid
                </p>

                <p className="mt-1 text-xl font-bold text-emerald-700">
                  ৳{advancePaid.toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl bg-orange-50 p-4">
                <p className="text-sm text-orange-600">
                  Remaining
                </p>

                <p className="mt-1 text-xl font-bold text-orange-700">
                  ৳{remainingDue.toFixed(2)}
                </p>
              </div>
            </div>

            {cancellationAllowed && (
              <div className="mt-6 rounded-2xl border-2 border-red-300 bg-red-50 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-red-800">
                      অর্ডার বাতিলের সময় চলছে
                    </p>

                    <p className="mt-1 text-sm text-red-700">
                      সময় শেষ হলে আর cancel করা যাবে না।
                    </p>
                  </div>

                  <div className="text-3xl font-black tracking-wider text-red-600">
                    {formatCountdown(
                      cancelSeconds
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={cancelling}
                  className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {cancelling
                    ? "Cancelling..."
                    : "Cancel Order"}
                </button>
              </div>
            )}

            {currentOrder.status === "confirmed" &&
              cancelSeconds <= 0 &&
              currentOrder.cancellation_deadline_at && (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                  ✅ Cancellation window ended.
                </div>
              )}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/order/${currentOrder.id}`}
                className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
              >
                View Order
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold">
              No active order
            </h2>

            <p className="mt-2 text-slate-500">
              You don't have an active order right now.
            </p>

            <Link
              href="/cafes"
              className="mt-5 inline-block rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
            >
              Browse Cafes
            </Link>
          </section>
        )}

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">
              Browse Cafes
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Choose a cafe and browse its food menu.
            </p>

            <Link
              href="/cafes"
              className="mt-5 inline-block rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
            >
              Browse Cafes
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">
              My Cart
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Check your selected food items and continue to checkout.
            </p>

            <Link
              href="/cart"
              className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Open Cart
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
                History
              </p>

              <h2 className="mt-2 text-2xl font-black">
                My Orders
              </h2>
            </div>

            <Link
              href="/student/orders"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View All Orders
            </Link>
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label
              htmlFor="student-order-search"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              Search Order
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="student-order-search"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by token, status, order ID or amount"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
            </div>

            {normalizedSearch && (
              <p className="mt-3 text-xs text-slate-500">
                {filteredHistoryOrders.length} order
                {filteredHistoryOrders.length === 1 ? "" : "s"} found.
              </p>
            )}
          </div>

          {historyOrders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h3 className="text-lg font-bold">
                No previous orders
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Your completed orders will appear here.
              </p>
            </div>
          ) : filteredHistoryOrders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h3 className="text-lg font-bold">
                Order not found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                No order matched your search.
              </p>

              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Show All Orders
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistoryOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <p className="text-lg font-bold">
                        {order.token_code}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {new Date(
                          order.created_at
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {formatOrderStatus(
                          order.status
                        )}
                      </span>

                      <span className="font-bold">
                        ৳
                        {Number(
                          order.total_amount
                        ).toFixed(2)}
                      </span>

                      <Link
                        href={`/order/${order.id}`}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </Link>
                    </div>
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