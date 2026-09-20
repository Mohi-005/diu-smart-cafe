"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Stats = {
  students: number;
  shopkeepers: number;
  cafes: number;
  orders: number;
  payments: number;
};

type Cafe = {
  id: string;
  name: string;
  bkash_number: string | null;
  poster_url: string | null;
  is_active: boolean;
};


export default function AdminPage() {
  const router = useRouter();

  const [stats, setStats] = useState<Stats>({
    students: 0,
    shopkeepers: 0,
    cafes: 0,
    orders: 0,
    payments: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [cafeLoading, setCafeLoading] = useState(true);
  const [cafeWorkingId, setCafeWorkingId] = useState<string | null>(null);
  const [editingCafeId, setEditingCafeId] = useState<string | null>(null);
  const [editCafeName, setEditCafeName] = useState("");
  const [editBkashNumber, setEditBkashNumber] = useState("");
  const [editPosterUrl, setEditPosterUrl] = useState("");
  const [cafeMessage, setCafeMessage] = useState("");
  const [cafeError, setCafeError] = useState("");

  const loadCafes = useCallback(async () => {
    setCafeLoading(true);
    setCafeError("");

    const { data, error: cafesError } = await supabase
      .from("cafes")
      .select("id, name, bkash_number, poster_url, is_active")
      .order("name");

    if (cafesError) {
      setCafeError(cafesError.message);
      setCafes([]);
    } else {
      setCafes((data ?? []) as Cafe[]);
    }

    setCafeLoading(false);
  }, []);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
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
          throw new Error(profileError.message);
        }

        if (profile?.role !== "admin") {
          router.replace("/");
          return;
        }

        const { data, error: statsError } =
          await supabase.rpc(
            "get_admin_dashboard_stats"
          );

        if (statsError) {
          throw new Error(statsError.message);
        }

        setStats({
          students: Number(data?.students ?? 0),
          shopkeepers: Number(data?.shopkeepers ?? 0),
          cafes: Number(data?.cafes ?? 0),
          orders: Number(data?.orders ?? 0),
          payments: Number(data?.payments ?? 0),
        });
      } catch (loadError) {
        console.error(loadError);

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load admin dashboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadDashboard();
    loadCafes();
  }, [loadDashboard, loadCafes]);

  function startCafeEdit(cafe: Cafe) {
    setEditingCafeId(cafe.id);
    setEditCafeName(cafe.name);
    setEditBkashNumber(cafe.bkash_number ?? "");
    setEditPosterUrl(cafe.poster_url ?? "");
    setCafeMessage("");
    setCafeError("");
  }

  function cancelCafeEdit() {
    setEditingCafeId(null);
    setEditCafeName("");
    setEditBkashNumber("");
    setEditPosterUrl("");
  }

  async function saveCafeEdit(cafeId: string) {
    if (!editCafeName.trim()) {
      setCafeError("Cafe name is required.");
      return;
    }

    setCafeWorkingId(cafeId);
    setCafeError("");
    setCafeMessage("");

    const { error: updateError } = await supabase
      .from("cafes")
      .update({
        name: editCafeName.trim(),
        bkash_number: editBkashNumber.trim() || null,
        poster_url: editPosterUrl.trim() || null,
      })
      .eq("id", cafeId);

    if (updateError) {
      setCafeError(updateError.message);
    } else {
      setCafeMessage("Cafe information updated successfully.");
      cancelCafeEdit();
      await loadCafes();
      await loadDashboard(true);
    }

    setCafeWorkingId(null);
  }

  async function toggleCafe(cafe: Cafe) {
    const actionText = cafe.is_active ? "temporarily hide" : "re-activate";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} "${cafe.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setCafeWorkingId(cafe.id);
    setCafeError("");
    setCafeMessage("");

    const { error: updateError } = await supabase
      .from("cafes")
      .update({ is_active: !cafe.is_active })
      .eq("id", cafe.id);

    if (updateError) {
      setCafeError(updateError.message);
    } else {
      setCafeMessage(
        cafe.is_active
          ? `"${cafe.name}" is now paused and hidden from students.`
          : `"${cafe.name}" is active again and visible to students.`
      );
      await loadCafes();
      await loadDashboard(true);
    }

    setCafeWorkingId(null);
  }

  async function deleteCafe(cafe: Cafe) {
    const confirmed = window.confirm(
      `Permanent Delete will remove "${cafe.name}" from the system. Continue?`
    );

    if (!confirmed) {
      return;
    }

    const doubleConfirmed = window.confirm(
      "This is permanent. Make sure this is the correct test/cafe record before continuing."
    );

    if (!doubleConfirmed) {
      return;
    }

    setCafeWorkingId(cafe.id);
    setCafeError("");
    setCafeMessage("");

    const { error: deleteError } = await supabase
      .from("cafes")
      .delete()
      .eq("id", cafe.id);

    if (deleteError) {
      setCafeError(
        `${deleteError.message} If related records prevent deletion, use the database's configured cascade/delete rule before retrying.`
      );
    } else {
      setCafeMessage(`"${cafe.name}" was permanently deleted.`);
      if (editingCafeId === cafe.id) {
        cancelCafeEdit();
      }
      await loadCafes();
      await loadDashboard(true);
    }

    setCafeWorkingId(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />

          <p className="mt-4 text-sm font-medium text-slate-500">
            Loading admin dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="shrink-0">
            <p className="text-lg font-black tracking-tight text-slate-950">
              DIU{" "}
              <span className="text-emerald-600">
                Smart Cafe
              </span>
            </p>

            <p className="text-xs text-slate-500">
              Admin Dashboard
            </p>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/admin/shops"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Admin Panel →
            </Link>

            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              )}

              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        {/* Heading */}
        <section>
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
            Administration
          </span>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Admin Dashboard
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            DIU Smart Cafe system overview and operational statistics.
          </p>
        </section>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5"
          >
            <p className="font-bold text-red-800">
              Unable to load dashboard
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* Statistics */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-blue-700">
              Students
            </p>

            <p className="mt-2 text-3xl font-black text-blue-700">
              {stats.students}
            </p>

            <p className="mt-1 text-xs text-blue-600">
              Registered student accounts
            </p>
          </div>

          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-purple-700">
              Shopkeepers
            </p>

            <p className="mt-2 text-3xl font-black text-purple-700">
              {stats.shopkeepers}
            </p>

            <p className="mt-1 text-xs text-purple-600">
              Staff accounts
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-700">
              Cafes
            </p>

            <p className="mt-2 text-3xl font-black text-emerald-700">
              {stats.cafes}
            </p>

            <p className="mt-1 text-xs text-emerald-600">
              Cafe records
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-orange-700">
              Orders
            </p>

            <p className="mt-2 text-3xl font-black text-orange-700">
              {stats.orders}
            </p>

            <p className="mt-1 text-xs text-orange-600">
              Total order records
            </p>
          </div>

          <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-pink-700">
              Payments
            </p>

            <p className="mt-2 text-3xl font-black text-pink-700">
              {stats.payments}
            </p>

            <p className="mt-1 text-xs text-pink-600">
              Total payment records
            </p>
          </div>
        </section>

        {/* Cafe Management */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
                Cafe Management
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Existing Cafes
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                এখান থেকে existing shop/cafe-এর information edit, temporary pause
                বা permanent delete করতে পারবেন। Pause করলে students cafe list-এ
                cafe-টি আর দেখতে পাবে না।
              </p>
            </div>

            <Link
              href="/admin/shops"
              className="inline-flex w-fit items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Admin Panel →
            </Link>
          </div>

          {cafeMessage && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              {cafeMessage}
            </div>
          )}

          {cafeError && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {cafeError}
            </div>
          )}

          <div className="mt-6">
            {cafeLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                Loading cafes...
              </div>
            ) : cafes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="font-bold text-slate-900">No cafes found</p>
                <p className="mt-2 text-sm text-slate-500">
                  Use the Admin Panel to create a new shop/cafe.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cafes.map((cafe) => (
                  <div
                    key={cafe.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-black text-slate-950">
                            {cafe.name}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              cafe.is_active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {cafe.is_active ? "Active" : "Paused / Hidden"}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                          <p>
                            <span className="font-bold text-slate-700">
                              bKash:
                            </span>{" "}
                            {cafe.bkash_number || "Not set"}
                          </p>

                          <p>
                            <span className="font-bold text-slate-700">
                              Student visibility:
                            </span>{" "}
                            {cafe.is_active ? "Visible" : "Hidden"}
                          </p>
                        </div>

                        {cafe.poster_url && (
                          <a
                            href={cafe.poster_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-block text-sm font-bold text-emerald-700 hover:underline"
                          >
                            Open cafe poster →
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startCafeEdit(cafe)}
                          disabled={cafeWorkingId === cafe.id}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleCafe(cafe)}
                          disabled={cafeWorkingId === cafe.id}
                          className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
                            cafe.is_active
                              ? "bg-amber-500 hover:bg-amber-600"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }`}
                        >
                          {cafe.is_active ? "Pause / Hide" : "Activate / Show"}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteCafe(cafe)}
                          disabled={cafeWorkingId === cafe.id}
                          className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Permanent Delete
                        </button>
                      </div>
                    </div>

                    {editingCafeId === cafe.id && (
                      <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-5">
                        <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
                          Edit Cafe
                        </p>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label
                              htmlFor={`cafe-name-${cafe.id}`}
                              className="mb-2 block text-sm font-bold text-slate-700"
                            >
                              Cafe Name
                            </label>

                            <input
                              id={`cafe-name-${cafe.id}`}
                              value={editCafeName}
                              onChange={(event) =>
                                setEditCafeName(event.target.value)
                              }
                              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`cafe-bkash-${cafe.id}`}
                              className="mb-2 block text-sm font-bold text-slate-700"
                            >
                              bKash Number
                            </label>

                            <input
                              id={`cafe-bkash-${cafe.id}`}
                              value={editBkashNumber}
                              onChange={(event) =>
                                setEditBkashNumber(event.target.value)
                              }
                              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label
                              htmlFor={`cafe-poster-${cafe.id}`}
                              className="mb-2 block text-sm font-bold text-slate-700"
                            >
                              Poster URL
                            </label>

                            <input
                              id={`cafe-poster-${cafe.id}`}
                              value={editPosterUrl}
                              onChange={(event) =>
                                setEditPosterUrl(event.target.value)
                              }
                              placeholder="https://..."
                              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            />
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => saveCafeEdit(cafe.id)}
                            disabled={cafeWorkingId === cafe.id}
                            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {cafeWorkingId === cafe.id
                              ? "Saving..."
                              : "Save Changes"}
                          </button>

                          <button
                            type="button"
                            onClick={cancelCafeEdit}
                            disabled={cafeWorkingId === cafe.id}
                            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Quick Access */}
        <section className="mt-8">
          <div className="mb-5">
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
              Quick Access
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Useful system pages
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Link
              href="/admin/shops"
              className="group rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-2xl">
                ⚙️
              </div>

              <h3 className="mt-5 text-xl font-black text-slate-950">
                Admin Panel
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Add new shops, create shopkeeper accounts and manage the
                administrative setup from one place.
              </p>

              <p className="mt-5 text-sm font-bold text-emerald-700 transition group-hover:translate-x-1">
                Open Admin Panel →
              </p>
            </Link>

            <Link
              href="/cafes"
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl">
                ☕
              </div>

              <h3 className="mt-5 text-xl font-black text-slate-950">
                Cafe Overview
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                View the cafes currently available in the DIU Smart Cafe
                system.
              </p>

              <p className="mt-5 text-sm font-bold text-emerald-600 transition group-hover:translate-x-1">
                Open Cafes →
              </p>
            </Link>

            <Link
              href="/"
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">
                🏠
              </div>

              <h3 className="mt-5 text-xl font-black text-slate-950">
                Public Home
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Open the main DIU Smart Cafe website and review the
                student-facing experience.
              </p>

              <p className="mt-5 text-sm font-bold text-blue-600 transition group-hover:translate-x-1">
                Open Home →
              </p>
            </Link>
          </div>
        </section>

        {/* Footer Note */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm leading-6 text-slate-500">
            Admin access is restricted to users with the{" "}
            <span className="font-bold text-slate-700">
              admin
            </span>{" "}
            role.
          </p>
        </section>
      </div>
    </main>
  );
}