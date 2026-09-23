"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";

type AddToCartButtonProps = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  cafeId: string;
  cafeName: string;
  available: boolean;
};

export default function AddToCartButton({
  id,
  name,
  price,
  imageUrl,
  cafeId,
  cafeName,
  available,
}: AddToCartButtonProps) {
  const { addToCart } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");

  function decrease() {
    setQuantity((current) => Math.max(1, current - 1));
    setMessage("");
  }

  function increase() {
    setQuantity((current) => Math.min(20, current + 1));
    setMessage("");
  }

  function handleQuantityInput(value: string) {
    if (value.trim() === "") {
      setQuantity(1);
      setMessage("");
      return;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
      setQuantity(1);
      setMessage("");
      return;
    }

    setQuantity(Math.max(1, Math.min(20, parsed)));
    setMessage("");
  }

  function handleAdd() {
    setMessage("");

    if (!available) {
      setMessage("This item is currently unavailable.");
      return;
    }

    const result = addToCart({
      id,
      name,
      price,
      image_url: imageUrl,
      cafe_id: cafeId,
      cafe_name: cafeName,
      quantity,
    });

    if (!result.success) {
      setMessage(result.message ?? "Unable to add item.");
      return;
    }

    setMessage(
      `${quantity} ${quantity === 1 ? "item" : "items"} added to cart.`
    );

    setQuantity(1);
  }

  if (!available) {
    return (
      <div className="w-full">
        <button
          type="button"
          disabled
          className="h-10 w-full cursor-not-allowed rounded-xl bg-slate-200 px-4 text-xs font-bold text-slate-400"
        >
          Unavailable
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-2">
      <div
        className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-300 bg-white p-1 shadow-sm"
        aria-label={`Quantity selector for ${name}`}
      >
        <button
          type="button"
          onClick={decrease}
          disabled={quantity <= 1}
          aria-label={`Decrease quantity of ${name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          −
        </button>

        <input
          type="number"
          min={1}
          max={20}
          value={quantity}
          onChange={(event) =>
            handleQuantityInput(event.target.value)
          }
          aria-label={`Quantity for ${name}`}
          className="min-w-0 flex-1 border-0 bg-transparent text-center text-sm font-black text-slate-900 outline-none [appearance:textfield]"
        />

        <button
          type="button"
          onClick={increase}
          disabled={quantity >= 20}
          aria-label={`Increase quantity of ${name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="h-10 w-full rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700"
      >
        Add {quantity} to Cart
      </button>

      <div className="min-h-5">
        {message && (
          <p
            className={`text-center text-[11px] leading-4 ${
              message.includes("added to cart")
                ? "text-emerald-600"
                : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}