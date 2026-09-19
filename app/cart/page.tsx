"use client";

import Link from "next/link";
import { useCart } from "@/components/student/CartProvider";

export default function CartPage() {
  const {
    items,
    itemCount,
    totalAmount,
    cafeName,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  if (items.length === 0) {
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
                Your Cart
              </p>
            </Link>

            <Link
              href="/menu"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Browse Menu
            </Link>
          </div>
        </header>

        {/* Empty Cart */}
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-5 py-12">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-5xl">
              🛒
            </div>

            <p className="mt-6 text-sm font-bold uppercase tracking-wider text-emerald-600">
              Your cart
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Your cart is empty
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
              Browse the available cafe menus, choose your food and add
              your favorite items to your cart.
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
              Your Cart
            </p>
          </Link>

          <Link
            href="/menu"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Continue Shopping
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-12">
        {/* Page Heading */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
              Pre-order cart
            </span>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Review your order
            </h1>

            <p className="mt-3 text-sm text-slate-500 sm:text-base">
              {cafeName || "Selected cafe"}
            </p>
          </div>

          <button
            type="button"
            onClick={clearCart}
            className="w-fit rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
          >
            Clear Cart
          </button>
        </div>

        {/* Main Content */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Cart Items */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-black text-slate-950">
                    {itemCount} item
                    {itemCount !== 1 ? "s" : ""}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    All items are from one selected cafe.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                  {cafeName || "Cafe selected"}
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center"
                >
                  {/* Image */}
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">
                        🍽️
                      </div>
                    )}
                  </div>

                  {/* Item Information */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-slate-950">
                      {item.name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      ৳{item.price.toFixed(2)} each
                    </p>

                    {/* Quantity Controls */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${item.name}`}
                        onClick={() => decreaseQuantity(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        −
                      </button>

                      <span className="flex min-w-8 justify-center text-center text-sm font-bold text-slate-900">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.name}`}
                        onClick={() => increaseQuantity(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        +
                      </button>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="ml-1 rounded-lg px-2 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 hover:text-red-700 sm:ml-3"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Item Subtotal */}
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-xs font-medium text-slate-400">
                      Subtotal
                    </p>

                    <p className="mt-1 text-lg font-black text-slate-950">
                      ৳{(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Order Summary */}
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-xl font-black text-slate-950">
              Order Summary
            </h2>

            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Items
                </span>

                <span className="font-bold text-slate-950">
                  {itemCount}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Food subtotal
                </span>

                <span className="font-bold text-slate-950">
                  ৳{totalAmount.toFixed(2)}
                </span>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4">
                <div className="flex justify-between gap-4">
                  <span className="text-sm font-semibold text-emerald-800">
                    Advance payment
                  </span>

                  <span className="text-sm font-black text-emerald-800">
                    ৳{(totalAmount * 0.5).toFixed(2)}
                  </span>
                </div>

                <p className="mt-1 text-xs leading-5 text-emerald-700">
                  50% advance payment is required during checkout.
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="flex justify-between gap-4">
                  <span className="font-bold text-slate-700">
                    Total
                  </span>

                  <span className="text-xl font-black text-slate-950">
                    ৳{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/checkout"
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Continue to Checkout
              <span aria-hidden="true">→</span>
            </Link>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-700">
                Next step
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Confirm your order details and complete the required
                advance payment at checkout.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}