"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RatingItem = {
  menu_item_id: string;
  food_name: string;
  rating: number | null;
  review: string;
};

type StudentRatingFormProps = {
  orderId: string;
  onSubmitted?: () => void;
};

export default function StudentRatingForm({
  orderId,
  onSubmitted,
}: StudentRatingFormProps) {
  const supabase = createClient();

  const [items, setItems] = useState<RatingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRatings() {
      setLoading(true);
      setError("");

      const { data, error: rpcError } = await supabase.rpc(
        "get_student_order_rating_items",
        {
          p_order_id: orderId,
        }
      );

      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }

      setItems(
        (data ?? []).map((item: any) => ({
          menu_item_id: item.menu_item_id,
          food_name: item.food_name,
          rating: item.rating ? Number(item.rating) : null,
          review: item.review ?? "",
        }))
      );

      setLoading(false);
    }

    loadRatings();
  }, [orderId]);

  function updateItem(
    menuItemId: string,
    patch: Partial<RatingItem>
  ) {
    setItems((current) =>
      current.map((item) =>
        item.menu_item_id === menuItemId
          ? { ...item, ...patch }
          : item
      )
    );
  }

  async function submitRatings() {
    setError("");
    setMessage("");

    const missing = items.find((item) => !item.rating);

    if (missing) {
      setError(
        `Please rate ${missing.food_name} before submitting.`
      );
      return;
    }

    setSaving(true);

    for (const item of items) {
      const { error: rpcError } = await supabase.rpc(
        "submit_food_rating",
        {
          p_order_id: orderId,
          p_menu_item_id: item.menu_item_id,
          p_rating: item.rating,
          p_review: item.review.trim() || null,
        }
      );

      if (rpcError) {
        setError(rpcError.message);
        setSaving(false);
        return;
      }
    }

    setMessage("Thank you. Your rating has been submitted.");
    setSaving(false);

    onSubmitted?.();
  }

  if (loading) {
    return (
      <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-bold text-amber-800">
          Loading rating form...
        </p>
      </section>
    );
  }

  if (error && items.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="font-bold text-red-800">
          Rating unavailable
        </p>

        <p className="mt-2 text-sm text-red-700">
          {error}
        </p>
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const alreadyRated = items.every(
    (item) => item.rating !== null
  );

  return (
    <section className="mt-8 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-amber-600">
          Student Rating
        </p>

        <h2 className="mt-2 text-2xl font-black text-slate-950">
          Rate your collected food
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Rating is required for each food item in this collected
          order.
        </p>
      </div>

      <div className="mt-6 space-y-5">
        {items.map((item) => (
          <div
            key={item.menu_item_id}
            className="rounded-2xl border border-slate-200 p-5"
          >
            <h3 className="font-bold text-slate-950">
              {item.food_name}
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    updateItem(item.menu_item_id, {
                      rating: value,
                    })
                  }
                  className={`h-10 w-10 rounded-xl text-lg font-black transition ${
                    item.rating === value
                      ? "bg-amber-500 text-white"
                      : "border border-slate-300 bg-white text-slate-500 hover:bg-amber-50"
                  }`}
                  aria-label={`${value} out of 5`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={item.review}
              onChange={(event) =>
                updateItem(item.menu_item_id, {
                  review: event.target.value,
                })
              }
              rows={3}
              maxLength={500}
              placeholder="Optional review"
              className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
            />
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <button
        type="button"
        onClick={submitRatings}
        disabled={saving || alreadyRated}
        className="mt-5 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving
          ? "Submitting..."
          : alreadyRated
            ? "Rating Submitted"
            : "Submit Rating"}
      </button>
    </section>
  );
}
