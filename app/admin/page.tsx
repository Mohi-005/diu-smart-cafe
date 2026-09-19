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
  }, [loadDashboard]);

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

          <div className="flex flex-wrap items-center gap-2">
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
                Browse the active cafes available in the DIU Smart Cafe
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

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                📊
              </div>

              <h3 className="mt-5 text-xl font-black text-slate-950">
                System Overview
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                The statistics above are loaded directly from the admin
                dashboard database function.
              </p>

              <button
                type="button"
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
                className="mt-5 text-sm font-bold text-slate-700 transition hover:text-slate-950 disabled:opacity-50"
              >
                Refresh Statistics →
              </button>
            </div>
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