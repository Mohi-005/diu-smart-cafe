"use client";

import { useEffect, useMemo, useState } from "react";

type ShopkeeperOrder = {
  order_id: string;
  token_code: string;
  cafe_id: string;
  status: string;
  total_amount: number;
  advance_paid: number;
  remaining_due: number;
  created_at: string;
  cancellation_deadline_at?: string | null;

  advance_payment_id?: string | null;
  advance_payment_status?: string | null;
  advance_payment_method?: string | null;
  advance_transaction_id?: string | null;

  remaining_transaction_id?: string | null;
  remaining_payment_method?: string | null;
  remaining_payment_status?: string | null;
};


function formatTime(seconds: number) {
  const safe = Math.max(seconds, 0);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    secs
  ).padStart(2, "0")}`;
}

function formatPaymentMethod(method?: string | null) {
  if (!method) return "Not available";

  if (method === "bkash") return "bKash";
  if (method === "nagad") return "Nagad";
  if (method === "cash") return "Cash";

  return method;
}

function formatPaymentStatus(status?: string | null) {
  if (!status) return "Not available";

  if (status === "paid") return "Paid";
  if (status === "submitted") return "Submitted";
  if (status === "refund_pending") return "Refund Pending";
  if (status === "refunded") return "Refunded";
  if (status === "unpaid") return "Unpaid";

  return status;
}

export default function ShopkeeperOrdersPage() {
  const [orders, setOrders] = useState<ShopkeeperOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now());

  const [paymentMethod, setPaymentMethod] = useState<
    Record<string, string>
  >({});

  const [transactionId, setTransactionId] = useState<
    Record<string, string>
  >({});

  const [workingId, setWorkingId] = useState<string | null>(
    null
  );

  async function loadOrders() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/shopkeeper/orders",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to load orders.");
        setOrders([]);
        return;
      }

      setOrders(
        Array.isArray(result.orders)
          ? (result.orders as ShopkeeperOrder[])
          : []
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load orders."
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function postAction(
    action: string,
    payload: Record<string, unknown> = {}
  ) {
    const response = await fetch(
      "/api/shopkeeper/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...payload,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to complete the order action."
      );
    }

    return result;
  }

  useEffect(() => {
    loadOrders();

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return orders;
    }

    return orders.filter((order) => {
      return (
        order.token_code
          ?.toLowerCase()
          .includes(query) ||
        order.order_id
          ?.toLowerCase()
          .includes(query) ||
        order.advance_transaction_id
          ?.toLowerCase()
          .includes(query) ||
        order.remaining_transaction_id
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [orders, search]);

  function isInstantOrder(order: ShopkeeperOrder) {
    return (
      Number(order.advance_paid) >=
      Number(order.total_amount) - 0.01
    );
  }

  function cancellationSeconds(order: ShopkeeperOrder) {
    if (isInstantOrder(order)) {
      return 0;
    }

    if (order.status === "cancelled") {
      return 0;
    }

    if (!order.cancellation_deadline_at) {
      return 0;
    }

    const deadline = new Date(
      order.cancellation_deadline_at
    ).getTime();

    return Math.max(
      Math.ceil((deadline - now) / 1000),
      0
    );
  }

  function canPrepare(order: ShopkeeperOrder) {
    if (order.status !== "confirmed") {
      return false;
    }

    if (isInstantOrder(order)) {
      return true;
    }

    return Boolean(
      order.cancellation_deadline_at &&
        cancellationSeconds(order) === 0
    );
  }

  async function startPreparing(order: ShopkeeperOrder) {
    if (!canPrepare(order)) {
      setError(
        "এই order এখনো preparation-এর জন্য eligible নয়।"
      );
      return;
    }

    const confirmed = window.confirm(
      `Token ${order.token_code}-এর খাবার তৈরি শুরু করবেন?`
    );

    if (!confirmed) {
      return;
    }

    setWorkingId(order.order_id);
    setError("");
    setMessage("");

    try {
      await postAction("prepare", {
        orderId: order.order_id,
      });

      setMessage(
        `Token ${order.token_code} এখন preparing status-এ আছে।`
      );

      await loadOrders();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to start preparing."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function markReady(orderId: string) {
    setWorkingId(orderId);
    setError("");
    setMessage("");

    try {
      await postAction("ready", {
        orderId,
      });

      setMessage("Order successfully marked as ready.");
      await loadOrders();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to mark order as ready."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function payRemaining(order: ShopkeeperOrder) {
    const method =
      paymentMethod[order.order_id];

    const txId =
      transactionId[order.order_id]?.trim() || null;

    if (!method) {
      setError(
        "Please select a remaining payment method."
      );
      return;
    }

    if (
      (method === "bkash" || method === "nagad") &&
      !txId
    ) {
      setError(
        "bKash বা Nagad হলে transaction ID দিতে হবে।"
      );
      return;
    }

    const confirmed = window.confirm(
      `৳${Number(
        order.remaining_due
      ).toFixed(
        2
      )} remaining payment paid হিসেবে record করবেন?`
    );

    if (!confirmed) {
      return;
    }

    setWorkingId(order.order_id);
    setError("");
    setMessage("");

    try {
      await postAction("remaining", {
        orderId: order.order_id,
        paymentMethod: method,
        transactionId: txId,
      });

      setMessage(
        `Token ${order.token_code}-এর remaining payment recorded.`
      );

      setPaymentMethod((prev) => ({
        ...prev,
        [order.order_id]: "",
      }));

      setTransactionId((prev) => ({
        ...prev,
        [order.order_id]: "",
      }));

      await loadOrders();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to record remaining payment."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function collectOrder(orderId: string) {
    const confirmed = window.confirm(
      "আপনি কি এই order collected হিসেবে mark করতে চান?"
    );

    if (!confirmed) {
      return;
    }

    setWorkingId(orderId);
    setError("");
    setMessage("");

    try {
      await postAction("collect", {
        orderId,
      });

      setMessage("Order successfully collected.");
      await loadOrders();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to collect order."
      );
    } finally {
      setWorkingId(null);
    }
  }

  const confirmedCount = orders.filter(
    (order) => order.status === "confirmed"
  ).length;

  const preparingCount = orders.filter(
    (order) => order.status === "preparing"
  ).length;

  const readyCount = orders.filter(
    (order) => order.status === "ready"
  ).length;

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
              Order Management
            </h1>

            <p className="mt-2 text-slate-600">
              আপনার নিজের shop-এর orders, payment status এবং
              preparation window এখান থেকে manage করুন।
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadOrders()}
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

        {/* Stats */}
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Confirmed
            </p>

            <p className="mt-2 text-3xl font-black text-blue-600">
              {confirmedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Preparing
            </p>

            <p className="mt-2 text-3xl font-black text-indigo-600">
              {preparingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Ready
            </p>

            <p className="mt-2 text-3xl font-black text-emerald-600">
              {readyCount}
            </p>
          </div>
        </section>

        {/* Search */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="w-full">
              <label
                htmlFor="orderSearch"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Search Order
              </label>

              <input
                id="orderSearch"
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Token code বা transaction ID"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
            Showing {filteredOrders.length} of{" "}
            {orders.length} orders
          </p>
        </section>

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

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold">
              No orders found
            </h2>

            <p className="mt-2 text-slate-500">
              এই shop-এর matching order পাওয়া যায়নি।
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredOrders.map((order) => {
              const instant =
                isInstantOrder(order);

              const remainingSeconds =
                cancellationSeconds(order);

              const preparationAllowed =
                canPrepare(order);

              const hasAdvancePayment =
                Boolean(
                  order.advance_payment_method ||
                    order.advance_transaction_id ||
                    order.advance_payment_status
                );

              const hasRemainingPayment =
                Boolean(
                  order.remaining_payment_method ||
                    order.remaining_transaction_id ||
                    order.remaining_payment_status
                );

              return (
                <article
                  key={order.order_id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="grid gap-4 md:grid-cols-5">
                    <div>
                      <p className="text-sm text-slate-500">
                        Token
                      </p>

                      <p className="mt-1 text-xl font-black">
                        {order.token_code}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Status
                      </p>

                      <p className="mt-1 font-bold uppercase text-emerald-600">
                        {order.status}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Total
                      </p>

                      <p className="mt-1 font-semibold">
                        ৳
                        {Number(
                          order.total_amount
                        ).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Advance Paid
                      </p>

                      <p className="mt-1 font-bold text-emerald-600">
                        ৳
                        {Number(
                          order.advance_paid
                        ).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Remaining
                      </p>

                      <p className="mt-1 font-bold text-orange-600">
                        ৳
                        {Number(
                          order.remaining_due
                        ).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Preparation information */}
                  {instant &&
                    order.status === "confirmed" && (
                      <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                        <p className="font-bold text-blue-700">
                          ⚡ Instant Buy — এখনই খাবার তৈরি করতে পারেন।
                        </p>
                      </div>
                    )}

                  {!instant &&
                    order.status === "confirmed" &&
                    remainingSeconds > 0 && (
                      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
                        <p className="font-bold text-red-700">
                          ⚠️ ৫ মিনিটের cancellation window চলছে।
                        </p>

                        <p className="mt-1 text-sm text-red-600">
                          এই সময় শেষ না হওয়া পর্যন্ত খাবার তৈরি করবেন না।
                        </p>

                        <p className="mt-3 text-3xl font-black text-red-600">
                          {formatTime(
                            remainingSeconds
                          )}
                        </p>
                      </div>
                    )}

                  {!instant &&
                    order.status === "confirmed" &&
                    remainingSeconds === 0 &&
                    order.cancellation_deadline_at && (
                      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                        <p className="font-bold text-emerald-700">
                          ✅ Cancellation window ended. এখন খাবার তৈরি করতে পারেন।
                        </p>
                      </div>
                    )}

                  {!instant &&
                    order.status === "confirmed" &&
                    !order.cancellation_deadline_at && (
                      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                        <p className="font-bold text-amber-700">
                          Payment deadline information unavailable.
                        </p>

                        <p className="mt-1 text-sm text-amber-600">
                          নিরাপত্তার জন্য preparation এখনো allow করা হয়নি।
                        </p>
                      </div>
                    )}

                  {/* Main actions */}
                  <div className="mt-6 flex flex-wrap gap-3">
                    {order.status === "confirmed" && (
                      <button
                        type="button"
                        onClick={() =>
                          startPreparing(order)
                        }
                        disabled={
                          workingId === order.order_id ||
                          !preparationAllowed
                        }
                        className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {!preparationAllowed &&
                        !instant
                          ? "Wait"
                          : "Start Preparing"}
                      </button>
                    )}

                    {order.status ===
                      "preparing" && (
                      <button
                        type="button"
                        onClick={() =>
                          markReady(order.order_id)
                        }
                        disabled={
                          workingId ===
                          order.order_id
                        }
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Mark Ready
                      </button>
                    )}

                    {order.status ===
                      "ready" &&
                      Number(
                        order.remaining_due
                      ) > 0 && (
                        <div className="flex w-full flex-col gap-3 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center">
                          <select
                            value={
                              paymentMethod[
                                order.order_id
                              ] || ""
                            }
                            onChange={(event) =>
                              setPaymentMethod(
                                (prev) => ({
                                  ...prev,
                                  [order.order_id]:
                                    event.target.value,
                                })
                              )
                            }
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
                          >
                            <option value="">
                              Select payment method
                            </option>

                            <option value="cash">
                              Cash
                            </option>

                            <option value="bkash">
                              bKash
                            </option>

                            <option value="nagad">
                              Nagad
                            </option>
                          </select>

                          <input
                            type="text"
                            placeholder="Transaction ID (bKash/Nagad)"
                            value={
                              transactionId[
                                order.order_id
                              ] || ""
                            }
                            onChange={(event) =>
                              setTransactionId(
                                (prev) => ({
                                  ...prev,
                                  [order.order_id]:
                                    event.target.value,
                                })
                              )
                            }
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              payRemaining(order)
                            }
                            disabled={
                              workingId ===
                              order.order_id
                            }
                            className="rounded-xl bg-orange-600 px-4 py-2.5 font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
                          >
                            Mark Remaining Paid
                          </button>
                        </div>
                      )}

                    {order.status ===
                      "ready" &&
                      Number(
                        order.remaining_due
                      ) === 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            collectOrder(
                              order.order_id
                            )
                          }
                          disabled={
                            workingId ===
                            order.order_id
                          }
                          className="rounded-xl bg-purple-600 px-4 py-2.5 font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60"
                        >
                          Mark Collected
                        </button>
                      )}
                  </div>

                  {/* Payment history */}
                  {(hasAdvancePayment ||
                    hasRemainingPayment) && (
                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <p className="text-sm font-bold text-slate-700">
                        Payment History
                      </p>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {hasAdvancePayment && (
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                            <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
                              Advance Payment
                            </p>

                            <div className="mt-3 space-y-2 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-500">
                                  Status
                                </span>

                                <span className="font-semibold">
                                  {formatPaymentStatus(
                                    order.advance_payment_status
                                  )}
                                </span>
                              </div>

                              <div className="flex justify-between gap-4">
                                <span className="text-slate-500">
                                  Method
                                </span>

                                <span className="font-semibold">
                                  {formatPaymentMethod(
                                    order.advance_payment_method
                                  )}
                                </span>
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="text-slate-500">
                                  Transaction ID
                                </span>

                                <span className="break-all font-semibold">
                                  {order.advance_transaction_id ||
                                    "Not available"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {hasRemainingPayment && (
                          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                            <p className="text-sm font-bold uppercase tracking-wide text-orange-700">
                              Remaining Payment
                            </p>

                            <div className="mt-3 space-y-2 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-500">
                                  Status
                                </span>

                                <span className="font-semibold">
                                  {formatPaymentStatus(
                                    order.remaining_payment_status
                                  )}
                                </span>
                              </div>

                              <div className="flex justify-between gap-4">
                                <span className="text-slate-500">
                                  Method
                                </span>

                                <span className="font-semibold">
                                  {formatPaymentMethod(
                                    order.remaining_payment_method
                                  )}
                                </span>
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="text-slate-500">
                                  Transaction ID
                                </span>

                                <span className="break-all font-semibold">
                                  {order.remaining_transaction_id ||
                                    "Not applicable — Cash payment"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}