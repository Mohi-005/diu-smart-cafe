"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useCart } from "@/components/student/CartProvider";
import { createClient } from "@/lib/supabase/client";

type OrderType = "preorder" | "instant";

type OrderResult = {
  order_id: string;
  token_code: string;
  total_amount: number;
  advance_amount: number;
  status: string;
  cancellation_deadline_at: string;
};

export default function CheckoutPage() {
  const router = useRouter();

  const {
    items,
    itemCount,
    totalAmount,
    cafeName,
    cafeId,
    clearCart,
  } = useCart();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [orderType, setOrderType] =
    useState<OrderType>("preorder");

  useEffect(() => {
    async function checkUser() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirect=/checkout");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_frozen")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "shopkeeper") {
        router.replace("/shopkeeper");
        return;
      }

      if (profile?.role === "admin") {
        router.replace("/admin");
        return;
      }

      if (
        profile?.role !== "student" ||
        profile.is_frozen === true
      ) {
        router.replace("/login?redirect=/checkout");
        return;
      }

      setCheckingAuth(false);
    }

    checkUser();
  }, [router]);

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />

          <p className="mt-4 text-sm font-medium text-slate-500">
            Checking your account...
          </p>
        </div>
      </main>
    );
  }

  if (!submitting && (items.length === 0 || !cafeId)) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-5xl">
              🛒
            </div>

            <p className="mt-6 text-sm font-bold uppercase tracking-wider text-emerald-600">
              Checkout
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Your cart is empty
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
              Add food from a cafe menu before continuing to checkout.
            </p>

            <Link
              href="/menu"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Browse Menu
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  async function handleCreateOrder() {
    if (submitting) {
      return;
    }

    if (!cafeId || items.length === 0) {
      setErrorMessage(
        "Your cart is empty or the selected cafe is missing."
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const cartItems = items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
      }));

      /*
       * Step 1:
       * Create the order through the secure student-only wrapper.
       *
       * This wrapper verifies:
       * - authenticated user
       * - student role
       * - student is not frozen
       */
      const { data, error } = await supabase.rpc(
        "create_pending_order_secure",
        {
          p_cafe_id: cafeId,
          p_items: cartItems,
        }
      );

      if (error) {
        setErrorMessage(error.message);
        setSubmitting(false);
        return;
      }

      if (!data || typeof data !== "object") {
        setErrorMessage(
          "The order could not be created. Please try again."
        );
        setSubmitting(false);
        return;
      }

      const result = data as OrderResult;

      if (!result.order_id) {
        setErrorMessage(
          "The order was created without a valid order ID. Please try again."
        );
        setSubmitting(false);
        return;
      }

      /*
       * Step 2:
       * For Instant Buy, convert the normal 50% payment
       * record into a full-payment record.
       *
       * The database function also removes the 5-minute
       * cancellation waiting period.
       */
      if (orderType === "instant") {
        const {
          error: instantError,
        } = await supabase.rpc("prepare_instant_order", {
          p_order_id: result.order_id,
        });

        if (instantError) {
          setErrorMessage(instantError.message);
          setSubmitting(false);
          return;
        }
      }

      /*
       * Only clear the local cart after all server-side
       * operations succeed.
       */
      clearCart();

      router.push(
        `/payment?order=${encodeURIComponent(result.order_id)}`
      );
    } catch (error) {
      console.error(
        "Checkout order creation error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while creating your order."
      );

      setSubmitting(false);
    }
  }

  const estimatedAdvance =
    orderType === "instant"
      ? totalAmount
      : totalAmount * 0.5;

  const estimatedRemaining =
    orderType === "instant"
      ? 0
      : totalAmount - estimatedAdvance;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="shrink-0">
            <p className="text-xl font-black text-slate-950">
              DIU{" "}
              <span className="text-emerald-600">
                Smart Cafe
              </span>
            </p>

            <p className="text-xs text-slate-500">
              Checkout
            </p>
          </Link>

          <Link
            href="/cart"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Back to Cart
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-12">
        {/* Page Heading */}
        <div>
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
            Checkout
          </span>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Confirm your order
          </h1>

          <p className="mt-3 text-sm text-slate-500 sm:text-base">
            {cafeName || "Selected cafe"}
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Left Side */}
          <div className="space-y-8">
            {/* Order Type */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">
                Choose Order Type
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Choose how you want to receive and pay for this order.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {/* Pre-order */}
                <button
                  type="button"
                  onClick={() => setOrderType("preorder")}
                  className={`rounded-2xl border-2 p-5 text-left transition ${
                    orderType === "preorder"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">
                        Pre-order
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Pay 50% advance now and the remaining amount
                        when the food is ready.
                      </p>
                    </div>

                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        orderType === "preorder"
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300"
                      }`}
                    >
                      {orderType === "preorder" && "✓"}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-white/70 p-3">
                    <p className="text-xs font-bold text-emerald-700">
                      50% advance payment
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      5-minute cancellation window applies.
                    </p>
                  </div>
                </button>

                {/* Instant Buy */}
                <button
                  type="button"
                  onClick={() => setOrderType("instant")}
                  className={`rounded-2xl border-2 p-5 text-left transition ${
                    orderType === "instant"
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">
                        Instant Buy ⚡
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Pay the full amount now. No 5-minute waiting
                        period.
                      </p>
                    </div>

                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        orderType === "instant"
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-300"
                      }`}
                    >
                      {orderType === "instant" && "✓"}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-white/70 p-3">
                    <p className="text-xs font-bold text-blue-700">
                      100% full payment
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Cash or bKash payment is available.
                    </p>
                  </div>
                </button>
              </div>
            </section>

            {/* Items */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-black text-slate-950">
                      Your items
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      {itemCount} item
                      {itemCount !== 1 ? "s" : ""} from{" "}
                      {cafeName || "this cafe"}
                    </p>
                  </div>

                  <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 sm:inline-flex">
                    Review before payment
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-200">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-2xl">
                          🍽️
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-950">
                        {item.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.quantity} × ৳
                        {item.price.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-xs font-medium text-slate-400">
                        Subtotal
                      </p>

                      <p className="mt-1 font-black text-slate-950">
                        ৳
                        {(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Summary */}
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-xl font-black text-slate-950">
              Order Summary
            </h2>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-500">
                  Items
                </span>

                <span className="font-bold text-slate-950">
                  {itemCount}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-500">
                  Estimated total
                </span>

                <span className="font-bold text-slate-950">
                  ৳{totalAmount.toFixed(2)}
                </span>
              </div>

              {/* Payment Summary */}
              <div
                className={`rounded-xl p-4 ${
                  orderType === "instant"
                    ? "bg-blue-50"
                    : "bg-emerald-50"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span
                    className={`text-sm font-semibold ${
                      orderType === "instant"
                        ? "text-blue-800"
                        : "text-emerald-800"
                    }`}
                  >
                    {orderType === "instant"
                      ? "Full payment"
                      : "Advance payment"}
                  </span>

                  <span
                    className={`text-sm font-black ${
                      orderType === "instant"
                        ? "text-blue-800"
                        : "text-emerald-800"
                    }`}
                  >
                    ৳{estimatedAdvance.toFixed(2)}
                  </span>
                </div>

                <p
                  className={`mt-1 text-xs leading-5 ${
                    orderType === "instant"
                      ? "text-blue-700"
                      : "text-emerald-700"
                  }`}
                >
                  {orderType === "instant"
                    ? "100% payment is required now."
                    : "50% advance payment is required now."}
                </p>
              </div>

              {/* Remaining */}
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-700">
                    Remaining payment
                  </span>

                  <span className="text-sm font-black text-slate-900">
                    ৳{estimatedRemaining.toFixed(2)}
                  </span>
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {orderType === "instant"
                    ? "No remaining payment."
                    : "Paid when the order is ready."}
                </p>
              </div>

              {/* Important Note */}
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs leading-5 text-slate-500">
                  The server will recalculate the final order total
                  using the current food prices before creating the
                  order.
                </p>
              </div>

              {/* Error */}
              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
                >
                  <p className="font-bold">
                    Unable to create order
                  </p>

                  <p className="mt-1">
                    {errorMessage}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Creating order...
                  </>
                ) : (
                  <>
                    Continue to Payment
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] leading-5 text-slate-400">
                Your order will be created only after the server
                successfully validates the cart and cafe.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}