"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PendingRatingItem = {
  order_id: string;
  token_code: string;
  menu_item_id: string;
  food_name: string;
  review: string | null;
  rating: number | null;
  order_created_at: string;
};

const supabase = createClient();

export default function StudentRatingGate() {
  const [checked, setChecked] = useState(false);
  const [items, setItems] = useState<PendingRatingItem[]>([]);
  const [draftRatings, setDraftRatings] = useState<Record<string, number | null>>({});
  const [draftReviews, setDraftReviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPendingRatings = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setItems([]);
      setChecked(true);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc(
      "get_student_pending_rating_items"
    );

    if (rpcError) {
      setError(rpcError.message);
      setChecked(true);
      return;
    }

    const nextItems = Array.isArray(data)
      ? (data as PendingRatingItem[])
      : [];

    setItems(nextItems);
    setChecked(true);
  }, []);

  useEffect(() => {
    void loadPendingRatings();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !saving) {
        void loadPendingRatings();
      }
    }, 3000);

    const visibilityHandler = () => {
      if (document.visibilityState === "visible" && !saving) {
        void loadPendingRatings();
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [loadPendingRatings, saving]);

  useEffect(() => {
    setDraftRatings((current) => {
      const next = { ...current };

      for (const item of items) {
        if (!(item.menu_item_id in next)) {
          next[item.menu_item_id] = item.rating ?? null;
        }
      }

      for (const key of Object.keys(next)) {
        if (!items.some((item) => item.menu_item_id === key)) {
          delete next[key];
        }
      }

      return next;
    });

    setDraftReviews((current) => {
      const next = { ...current };

      for (const item of items) {
        if (!(item.menu_item_id in next)) {
          next[item.menu_item_id] = item.review ?? "";
        }
      }

      for (const key of Object.keys(next)) {
        if (!items.some((item) => item.menu_item_id === key)) {
          delete next[key];
        }
      }

      return next;
    });
  }, [items]);

  const pendingOrder = items[0] ?? null;

  const pendingItemsForOrder = useMemo(() => {
    if (!pendingOrder) {
      return [];
    }

    return items.filter(
      (item) => item.order_id === pendingOrder.order_id
    );
  }, [items, pendingOrder]);

  const allRated =
    pendingItemsForOrder.length > 0 &&
    pendingItemsForOrder.every(
      (item) => Boolean(draftRatings[item.menu_item_id])
    );

  async function submitRatings() {
    if (!allRated || saving) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    for (const item of pendingItemsForOrder) {
      const rating = draftRatings[item.menu_item_id];

      if (!rating) {
        setError(`Please rate ${item.food_name} before continuing.`);
        setSaving(false);
        return;
      }

      const { error: rpcError } = await supabase.rpc(
        "submit_food_rating",
        {
          p_order_id: item.order_id,
          p_menu_item_id: item.menu_item_id,
          p_rating: rating,
          p_review:
            draftReviews[item.menu_item_id]?.trim() || null,
        }
      );

      if (rpcError) {
        setError(rpcError.message);
        setSaving(false);
        return;
      }
    }

    setMessage("Thank you. Your rating has been submitted.");

    await loadPendingRatings();
    setSaving(false);
  }

  if (!checked || items.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mandatory-rating-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-2xl"
      >
        <div className="border-b border-amber-100 bg-amber-50 px-6 py-5 sm:px-7">
          <p className="text-sm font-black uppercase tracking-wider text-amber-700">
            Rating Required
          </p>

          <h2
            id="mandatory-rating-title"
            className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl"
          >
            আপনার collected food-এর rating দিন
          </h2>

          <p className="mt-2 text-sm leading-6 text-amber-900">
            এই order-এর প্রতিটি food item-এর rating submit না করা পর্যন্ত student
            section-এ এগোনো যাবে না। Review চাইলে দিতে পারেন, কিন্তু rating দেওয়া
            বাধ্যতামূলক।
          </p>

          <p className="mt-3 text-sm font-bold text-slate-700">
            Order Token: {pendingOrder?.token_code}
          </p>
        </div>

        <div className="overflow-y-auto px-6 py-6 sm:px-7">
          <div className="space-y-5">
            {pendingItemsForOrder.map((item) => {
              const selectedRating = draftRatings[item.menu_item_id];

              return (
                <div
                  key={item.menu_item_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h3 className="font-black text-slate-950">
                    {item.food_name}
                  </h3>

                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Rating: {selectedRating ? `${selectedRating}/5` : "Required"}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setDraftRatings((current) => ({
                            ...current,
                            [item.menu_item_id]: value,
                          }))
                        }
                        className={`h-11 w-11 rounded-xl text-xl font-black transition ${
                          selectedRating === value
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
                    value={draftReviews[item.menu_item_id] ?? ""}
                    onChange={(event) =>
                      setDraftReviews((current) => ({
                        ...current,
                        [item.menu_item_id]: event.target.value,
                      }))
                    }
                    rows={3}
                    maxLength={500}
                    placeholder="Optional review"
                    className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={submitRatings}
            disabled={!allRated || saving}
            className="mt-6 w-full rounded-xl bg-amber-500 px-5 py-3.5 text-sm font-black text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Submitting ratings..."
              : allRated
                ? "Submit Rating & Continue"
                : "Rate every food item to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
