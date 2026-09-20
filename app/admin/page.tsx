"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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
  description: string | null;
  location: string | null;
  is_active: boolean;
  advance_payment_percent: number;
  bkash_number: string | null;
  bkash_cashout_fee_percentage: number;
  poster_url: string | null;
  created_at: string;
  updated_at: string;
};

function isValidBkashNumber(value: string) {
  return /^01\d{9}$/.test(value.trim());
}

function getRpcObject<T>(data: T | T[] | null): T | null {
  if (!data) {
    return null;
  }

  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data;
}

function createPosterFileName(file: File) {
  const cleanName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${crypto.randomUUID()}-${cleanName || "cafe-poster"}`;
}

export default function AdminPage() {
  const router = useRouter();

  const [stats, setStats] = useState<Stats>({
    students: 0,
    shopkeepers: 0,
    cafes: 0,
    orders: 0,
    payments: 0,
  });

  const [cafes, setCafes] = useState<Cafe[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingCafe, setSavingCafe] = useState(false);
  const [workingCafeId, setWorkingCafeId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [editingCafeId, setEditingCafeId] = useState<string | null>(null);

  const [cafeName, setCafeName] = useState("");
  const [bkashNumber, setBkashNumber] = useState("");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [currentPosterUrl, setCurrentPosterUrl] = useState<string | null>(
    null
  );

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

        const { data: profile, error: profileError } = await supabase
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

        const [
          { data: statsData, error: statsError },
          { data: cafeData, error: cafeError },
        ] = await Promise.all([
          supabase.rpc("get_admin_dashboard_stats"),
          supabase.rpc("admin_get_cafes"),
        ]);

        if (statsError) {
          throw new Error(statsError.message);
        }

        if (cafeError) {
          throw new Error(cafeError.message);
        }

        setStats({
          students: Number(statsData?.students ?? 0),
          shopkeepers: Number(statsData?.shopkeepers ?? 0),
          cafes: Number(statsData?.cafes ?? 0),
          orders: Number(statsData?.orders ?? 0),
          payments: Number(statsData?.payments ?? 0),
        });

        setCafes((cafeData || []) as Cafe[]);
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

  function resetCafeForm() {
    setEditingCafeId(null);
    setCafeName("");
    setBkashNumber("");
    setPosterFile(null);
    setCurrentPosterUrl(null);

    const fileInput = document.getElementById(
      "cafe-poster"
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }
  }

  function startEditCafe(cafe: Cafe) {
    setEditingCafeId(cafe.id);
    setCafeName(cafe.name);
    setBkashNumber(cafe.bkash_number || "");
    setCurrentPosterUrl(cafe.poster_url || null);
    setPosterFile(null);

    const fileInput = document.getElementById(
      "cafe-poster"
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function uploadPoster(file: File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please select a valid image file.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Poster image must be 5 MB or smaller.");
    }

    const fileName = createPosterFileName(file);
    const storagePath = `cafes/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("cafe-posters")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("cafe-posters")
      .getPublicUrl(storagePath);

    return {
      publicUrl,
      storagePath,
    };
  }

  async function handleCafeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSavingCafe(true);
    setError("");
    setMessage("");

    let uploadedStoragePath: string | null = null;

    try {
      const cleanName = cafeName.trim();
      const cleanBkash = bkashNumber.trim();

      if (!cleanName) {
        throw new Error("Cafe name is required.");
      }

      if (!isValidBkashNumber(cleanBkash)) {
        throw new Error(
          "Please enter a valid 11-digit bKash number starting with 01."
        );
      }

      if (!editingCafeId && !posterFile) {
        throw new Error("Please select a cafe poster.");
      }

      let posterUrl = currentPosterUrl;

      if (posterFile) {
        const uploadResult = await uploadPoster(posterFile);
        posterUrl = uploadResult.publicUrl;
        uploadedStoragePath = uploadResult.storagePath;
      }

      if (editingCafeId) {
        const { data, error: updateError } = await supabase.rpc(
          "admin_update_cafe",
          {
            p_cafe_id: editingCafeId,
            p_name: cleanName,
            p_bkash_number: cleanBkash,
            p_poster_url: posterUrl,
          }
        );

        if (updateError) {
          throw new Error(updateError.message);
        }

        const updatedCafe = getRpcObject<Cafe>(data);

        setMessage(
          updatedCafe
            ? `${updatedCafe.name} updated successfully.`
            : "Cafe updated successfully."
        );
      } else {
        const { data, error: createError } = await supabase.rpc(
          "admin_create_cafe",
          {
            p_name: cleanName,
            p_bkash_number: cleanBkash,
            p_poster_url: posterUrl,
          }
        );

        if (createError) {
          throw new Error(createError.message);
        }

        const createdCafe = getRpcObject<Cafe>(data);

        setMessage(
          createdCafe
            ? `${createdCafe.name} added successfully.`
            : "Cafe added successfully."
        );
      }

      resetCafeForm();

      await loadDashboard(true);
    } catch (saveError) {
      console.error(saveError);

      if (uploadedStoragePath) {
        await supabase.storage
          .from("cafe-posters")
          .remove([uploadedStoragePath]);
      }

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save cafe."
      );
    } finally {
      setSavingCafe(false);
    }
  }

  async function toggleCafe(cafe: Cafe) {
    setWorkingCafeId(cafe.id);
    setError("");
    setMessage("");

    try {
      const { error: toggleError } = await supabase.rpc(
        "admin_set_cafe_active",
        {
          p_cafe_id: cafe.id,
          p_is_active: !cafe.is_active,
        }
      );

      if (toggleError) {
        throw new Error(toggleError.message);
      }

      setMessage(
        `${cafe.name} is now ${!cafe.is_active ? "visible" : "hidden"} for students.`
      );

      await loadDashboard(true);
    } catch (toggleError) {
      console.error(toggleError);

      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to change cafe visibility."
      );
    } finally {
      setWorkingCafeId(null);
    }
  }

  async function deleteCafe(cafe: Cafe) {
    const firstConfirm = window.confirm(
      `Permanently delete "${cafe.name}"?\n\nThis will delete the cafe and its related menu, staff assignment, orders and payment records. This action cannot be undone.`
    );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.confirm(
      `Final confirmation:\n\nDelete "${cafe.name}" permanently?`
    );

    if (!secondConfirm) {
      return;
    }

    setWorkingCafeId(cafe.id);
    setError("");
    setMessage("");

    try {
      const { error: deleteError } = await supabase.rpc(
        "admin_delete_cafe",
        {
          p_cafe_id: cafe.id,
        }
      );

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setMessage(`${cafe.name} was permanently deleted.`);

      if (editingCafeId === cafe.id) {
        resetCafeForm();
      }

      await loadDashboard(true);
    } catch (deleteError) {
      console.error(deleteError);

      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete cafe."
      );
    } finally {
      setWorkingCafeId(null);
    }
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
              Something went wrong
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* Success */}
        {message && (
          <div
            role="status"
            className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
          >
            <p className="font-semibold text-emerald-800">
              {message}
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
        <section className="mt-10">
          <div className="mb-5">
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
              Cafe Management
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {editingCafeId ? "Edit Cafe" : "Add New Cafe"}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Add or manage cafes, bKash numbers, posters and student
              visibility from one place.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            {/* Cafe Form */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-950">
                    {editingCafeId ? "Edit Cafe" : "Add Cafe"}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    bKash cash-out fee is fixed at 1.85%.
                  </p>
                </div>

                {editingCafeId && (
                  <button
                    type="button"
                    onClick={resetCafeForm}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form
                onSubmit={handleCafeSubmit}
                className="mt-6 space-y-5"
              >
                <div>
                  <label
                    htmlFor="cafe-name"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    Cafe Name
                  </label>

                  <input
                    id="cafe-name"
                    type="text"
                    value={cafeName}
                    onChange={(event) =>
                      setCafeName(event.target.value)
                    }
                    placeholder="e.g. Food Court"
                    disabled={savingCafe}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="bkash-number"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    bKash Number
                  </label>

                  <input
                    id="bkash-number"
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    value={bkashNumber}
                    onChange={(event) =>
                      setBkashNumber(
                        event.target.value.replace(/\D/g, "")
                      )
                    }
                    placeholder="01XXXXXXXXX"
                    disabled={savingCafe}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    Students will see this number on the payment page.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="cafe-poster"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    Cafe Poster
                    {!editingCafeId && (
                      <span className="text-red-500"> *</span>
                    )}
                  </label>

                  <input
                    id="cafe-poster"
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setPosterFile(
                        event.target.files?.[0] ?? null
                      )
                    }
                    disabled={savingCafe}
                    className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-emerald-700"
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    JPG, PNG, WEBP or another image format. Maximum 5 MB.
                  </p>
                </div>

                {currentPosterUrl && (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <img
                      src={currentPosterUrl}
                      alt={`${cafeName || "Cafe"} poster`}
                      className="h-44 w-full object-cover"
                    />
                  </div>
                )}

                {posterFile && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-700">
                      New poster selected:
                    </p>

                    <p className="mt-1 truncate text-sm text-emerald-900">
                      {posterFile.name}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingCafe}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingCafe && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}

                  {savingCafe
                    ? "Saving..."
                    : editingCafeId
                    ? "Update Cafe"
                    : "Add Cafe"}
                </button>

                {!editingCafeId && (
                  <p className="text-center text-xs text-slate-500">
                    New cafes are created as visible to students.
                  </p>
                )}
              </form>
            </div>

            {/* Cafe List */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-950">
                    Existing Cafes
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Admin can see both visible and hidden cafes.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {cafes.length} cafe{cafes.length === 1 ? "" : "s"}
                </span>
              </div>

              {cafes.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="font-semibold text-slate-700">
                    No cafes found
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Add your first cafe using the form.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {cafes.map((cafe) => {
                    const working = workingCafeId === cafe.id;

                    return (
                      <div
                        key={cafe.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                      >
                        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                          <div className="bg-slate-200">
                            {cafe.poster_url ? (
                              <img
                                src={cafe.poster_url}
                                alt={`${cafe.name} poster`}
                                className="h-full min-h-40 w-full object-cover"
                              />
                            ) : (
                              <div className="flex min-h-40 items-center justify-center text-4xl text-slate-400">
                                ☕
                              </div>
                            )}
                          </div>

                          <div className="p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-xl font-black text-slate-950">
                                    {cafe.name}
                                  </h4>

                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                      cafe.is_active
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-slate-200 text-slate-600"
                                    }`}
                                  >
                                    {cafe.is_active
                                      ? "Visible"
                                      : "Hidden"}
                                  </span>
                                </div>

                                <p className="mt-2 text-sm text-slate-500">
                                  bKash:{" "}
                                  <span className="font-semibold text-slate-700">
                                    {cafe.bkash_number || "Not set"}
                                  </span>
                                </p>

                                <p className="mt-1 text-sm text-slate-500">
                                  Cash-out fee:{" "}
                                  <span className="font-semibold text-slate-700">
                                    1.85%
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  startEditCafe(cafe)
                                }
                                disabled={working || savingCafe}
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleCafe(cafe)
                                }
                                disabled={working}
                                className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                                  cafe.is_active
                                    ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                } disabled:cursor-not-allowed disabled:opacity-50`}
                              >
                                {working
                                  ? "Working..."
                                  : cafe.is_active
                                  ? "Hide Cafe"
                                  : "Show Cafe"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteCafe(cafe)
                                }
                                disabled={working}
                                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {working
                                  ? "Working..."
                                  : "Permanent Delete"}
                              </button>
                            </div>

                            <p className="mt-4 text-xs leading-5 text-slate-500">
                              Hide keeps the cafe in the system but removes
                              it from the student cafe list. Permanent Delete
                              removes the cafe and its related records.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Quick Access */}
        <section className="mt-10">
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