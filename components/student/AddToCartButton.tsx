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

  const [message, setMessage] = useState("");

  function handleAdd() {
    setMessage("");

    const result = addToCart({
      id,
      name,
      price,
      image_url: imageUrl,
      cafe_id: cafeId,
      cafe_name: cafeName,
      quantity: 1,
    });

    if (!result.success) {
      setMessage(result.message ?? "Unable to add item.");
      return;
    }

    setMessage("Added to cart.");
  }

  if (!available) {
    return (
      <button
        disabled
        className="cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-400"
      >
        Sold Out
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleAdd}
        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
      >
        Add to Cart
      </button>

      {message && (
        <p
          className={`max-w-48 text-right text-[11px] leading-4 ${
            message === "Added to cart."
              ? "text-emerald-600"
              : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}