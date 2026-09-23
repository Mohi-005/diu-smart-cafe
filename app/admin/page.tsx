"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

type CafeStatus =
  | "active"
  | "paused"
  | "hidden";

type Cafe = {
  id: string;
  name: string;
  logo_url: string | null;
  phone_number: string | null;
  bkash_number: string | null;
  owner_id: string | null;
  shopkeeper_id: string | null;
  status: CafeStatus;
  is_active: boolean;
  created_at: string;
};

type Student = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string;
  is_frozen: boolean;
};

type ControlTab =
  | "shops"
  | "students";

export default function AdminPage() {
  const router = useRouter();

  const [stats, setStats] =
    useState<Stats>({
      students: 0,
      shopkeepers: 0,
      cafes: 0,
      orders: 0,
      payments: 0,
    });

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [activeTab, setActiveTab] =
    useState<ControlTab>("shops");

  /* -------------------------------------------------------
     Shops
  ------------------------------------------------------- */

  const [cafes, setCafes] =
    useState<Cafe[]>([]);

  const [cafeLoading, setCafeLoading] =
    useState(false);

  const [cafeError, setCafeError] =
    useState("");

  const [cafeMessage, setCafeMessage] =
    useState("");

  const [cafeWorkingId, setCafeWorkingId] =
    useState<string | null>(null);

  const [editingCafeId, setEditingCafeId] =
    useState<string | null>(null);

  const [editCafeName, setEditCafeName] =
    useState("");

  const [editLogoFile, setEditLogoFile] =
    useState<File | null>(null);

  const [editLogoPreview, setEditLogoPreview] =
    useState<string | null>(null);

  const [editPhoneNumber, setEditPhoneNumber] =
    useState("");

  const [editBkashNumber, setEditBkashNumber] =
    useState("");

  /* -------------------------------------------------------
     Students
  ------------------------------------------------------- */

  const [students, setStudents] =
    useState<Student[]>([]);

  const [studentLoading, setStudentLoading] =
    useState(false);

  const [studentError, setStudentError] =
    useState("");

  const [studentMessage, setStudentMessage] =
    useState("");

  const [studentSearch, setStudentSearch] =
    useState("");

  const [studentWorkingId, setStudentWorkingId] =
    useState<string | null>(null);

  /* =======================================================
     SHOP LOADING
  ======================================================= */

  const loadCafes = useCallback(
    async () => {
      setCafeLoading(true);
      setCafeError("");

      try {
        const response = await fetch(
          "/api/admin/shops",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to load shops."
          );
        }

        setCafes(
          Array.isArray(data?.cafes)
            ? data.cafes
            : []
        );
      } catch (loadError) {
        setCafeError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load shops."
        );

        setCafes([]);
      } finally {
        setCafeLoading(false);
      }
    },
    []
  );

  /* =======================================================
     STUDENT LOADING
  ======================================================= */

  const loadStudents = useCallback(
    async (
      searchValue = ""
    ) => {
      setStudentLoading(true);
      setStudentError("");

      try {
        const query =
          searchValue.trim();

        const url = query
          ? `/api/admin/students?search=${encodeURIComponent(
              query
            )}`
          : "/api/admin/students";

        const response =
          await fetch(url, {
            method: "GET",
            cache: "no-store",
          });

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to load students."
          );
        }

        setStudents(
          Array.isArray(data?.students)
            ? data.students
            : []
        );
      } catch (loadError) {
        setStudentError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load students."
        );

        setStudents([]);
      } finally {
        setStudentLoading(false);
      }
    },
    []
  );

  /* =======================================================
     DASHBOARD
  ======================================================= */

  const loadDashboard =
    useCallback(
      async (
        isRefresh = false
      ) => {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const {
            data: {
              user,
            },
          } =
            await supabase.auth.getUser();

          if (!user) {
            router.replace(
              "/login"
            );
            return;
          }

          const {
            data: profile,
            error:
              profileError,
          } =
            await supabase
              .from("profiles")
              .select("role")
              .eq(
                "id",
                user.id
              )
              .maybeSingle();

          if (profileError) {
            throw new Error(
              profileError.message
            );
          }

          if (
            profile?.role !==
            "admin"
          ) {
            router.replace("/");
            return;
          }

          const {
            data,
            error:
              statsError,
          } =
            await supabase.rpc(
              "get_admin_dashboard_stats"
            );

          if (statsError) {
            throw new Error(
              statsError.message
            );
          }

          setStats({
            students: Number(
              data?.students ?? 0
            ),

            shopkeepers: Number(
              data?.shopkeepers ?? 0
            ),

            cafes: Number(
              data?.cafes ?? 0
            ),

            orders: Number(
              data?.orders ?? 0
            ),

            payments: Number(
              data?.payments ?? 0
            ),
          });

          await loadCafes();

          if (
            activeTab ===
            "students"
          ) {
            await loadStudents(
              studentSearch
            );
          }
        } catch (loadError) {
          console.error(
            loadError
          );

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
      [
        activeTab,
        loadCafes,
        loadStudents,
        router,
        studentSearch,
      ]
    );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /* =======================================================
     STUDENT SEARCH
  ======================================================= */

  useEffect(() => {
    if (
      activeTab !==
      "students"
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          loadStudents(
            studentSearch
          );
        },
        300
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    activeTab,
    loadStudents,
    studentSearch,
  ]);

  /* =======================================================
     SHOP EDIT
  ======================================================= */

  function startCafeEdit(
    cafe: Cafe
  ) {
    setEditingCafeId(
      cafe.id
    );

    setEditCafeName(
      cafe.name
    );

    if (editLogoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editLogoPreview);
    }

    setEditLogoFile(null);
    setEditLogoPreview(cafe.logo_url ?? null);

    setEditPhoneNumber(
      cafe.phone_number ?? ""
    );

    setEditBkashNumber(
      cafe.bkash_number ?? ""
    );

    setCafeError("");
    setCafeMessage("");
  }

  function cancelCafeEdit() {
    setEditingCafeId(null);

    if (editLogoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editLogoPreview);
    }

    setEditCafeName("");
    setEditLogoFile(null);
    setEditLogoPreview(null);
    setEditPhoneNumber("");
    setEditBkashNumber("");
  }

  function handleEditLogoChange(file: File | null) {
    setCafeError("");

    if (!file) {
      setEditLogoFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setCafeError("Please select a valid cafe logo image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setCafeError("Cafe logo image size must be 5 MB or less.");
      return;
    }

    if (editLogoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editLogoPreview);
    }

    setEditLogoFile(file);
    setEditLogoPreview(URL.createObjectURL(file));
  }

  async function saveCafeEdit(
    cafeId: string
  ) {
    if (
      !editCafeName.trim()
    ) {
      setCafeError(
        "Shop name is required."
      );
      return;
    }

    setCafeWorkingId(
      cafeId
    );

    setCafeError("");
    setCafeMessage("");

    try {
      const formData = new FormData();
      formData.append("shopId", cafeId);
      formData.append("name", editCafeName.trim());
      formData.append("phoneNumber", editPhoneNumber.trim());
      formData.append("bkashNumber", editBkashNumber.trim());

      if (editLogoFile) {
        formData.append("logo", editLogoFile);
      }

      const response =
        await fetch(
          "/api/admin/shops",
          {
            method: "PATCH",
            body: formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to update shop."
        );
      }

      setCafeMessage(
        "Shop information updated successfully."
      );

      cancelCafeEdit();

      await loadCafes();
      await loadDashboard(
        true
      );
    } catch (updateError) {
      setCafeError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update shop."
      );
    } finally {
      setCafeWorkingId(
        null
      );
    }
  }

  /* =======================================================
     SHOP STATUS
  ======================================================= */

  async function changeCafeStatus(
    cafe: Cafe,
    status: CafeStatus
  ) {
    const actionText =
      status === "active"
        ? "activate/show"
        : status === "paused"
        ? "pause"
        : "hide";

    const confirmed =
      window.confirm(
        `Are you sure you want to ${actionText} "${cafe.name}"?`
      );

    if (!confirmed) {
      return;
    }

    setCafeWorkingId(
      cafe.id
    );

    setCafeError("");
    setCafeMessage("");

    try {
      const formData = new FormData();
      formData.append("shopId", cafe.id);
      formData.append("status", status);

      const response =
        await fetch(
          "/api/admin/shops",
          {
            method: "PATCH",
            body: formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to change shop status."
        );
      }

      setCafeMessage(
        status === "active"
          ? `"${cafe.name}" is active and visible.`
          : status === "paused"
          ? `"${cafe.name}" is paused.`
          : `"${cafe.name}" is hidden.`
      );

      await loadCafes();
      await loadDashboard(
        true
      );
    } catch (statusError) {
      setCafeError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to change shop status."
      );
    } finally {
      setCafeWorkingId(
        null
      );
    }
  }

  /* =======================================================
     SHOP DELETE
  ======================================================= */

  async function deleteCafe(
    cafe: Cafe
  ) {
    const first =
      window.confirm(
        `Permanent Delete will permanently remove "${cafe.name}". Continue?`
      );

    if (!first) {
      return;
    }

    const second =
      window.confirm(
        "This cannot be undone. Delete this shop and its linked shopkeeper account?"
      );

    if (!second) {
      return;
    }

    setCafeWorkingId(
      cafe.id
    );

    setCafeError("");
    setCafeMessage("");

    try {
      const response =
        await fetch(
          `/api/admin/shops?id=${encodeURIComponent(
            cafe.id
          )}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to delete shop."
        );
      }

      setCafeMessage(
        data?.warning ||
          `"${cafe.name}" was permanently deleted.`
      );

      if (
        editingCafeId ===
        cafe.id
      ) {
        cancelCafeEdit();
      }

      await loadCafes();
      await loadDashboard(
        true
      );
    } catch (deleteError) {
      setCafeError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete shop."
      );
    } finally {
      setCafeWorkingId(
        null
      );
    }
  }

  /* =======================================================
     STUDENT FREEZE
  ======================================================= */

  async function setStudentFrozen(
    student: Student
  ) {
    const nextFrozen =
      !student.is_frozen;

    const actionText =
      nextFrozen
        ? "freeze"
        : "activate";

    const confirmed =
      window.confirm(
        `Are you sure you want to ${actionText} this student account?`
      );

    if (!confirmed) {
      return;
    }

    setStudentWorkingId(
      student.id
    );

    setStudentError("");
    setStudentMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/students",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              studentId:
                student.id,
              action:
                nextFrozen
                  ? "freeze"
                  : "unfreeze",
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to change student status."
        );
      }

      setStudentMessage(
        data?.message ||
          "Student account status updated."
      );

      await loadStudents(
        studentSearch
      );

      await loadDashboard(
        true
      );
    } catch (statusError) {
      setStudentError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to change student status."
      );
    } finally {
      setStudentWorkingId(
        null
      );
    }
  }

  /* =======================================================
     STUDENT DELETE
  ======================================================= */

  async function deleteStudent(
    student: Student
  ) {
    const displayName =
      student.username ||
      student.full_name ||
      student.email;

    const first =
      window.confirm(
        `Permanent Delete will remove "${displayName}". Continue?`
      );

    if (!first) {
      return;
    }

    const second =
      window.confirm(
        "This will permanently delete the student's database records and Supabase Auth account. Continue?"
      );

    if (!second) {
      return;
    }

    setStudentWorkingId(
      student.id
    );

    setStudentError("");
    setStudentMessage("");

    try {
      const response =
        await fetch(
          `/api/admin/students?id=${encodeURIComponent(
            student.id
          )}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to delete student."
        );
      }

      setStudentMessage(
        data?.warning ||
          "Student account permanently deleted."
      );

      await loadStudents(
        studentSearch
      );

      await loadDashboard(
        true
      );
    } catch (deleteError) {
      setStudentError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete student."
      );
    } finally {
      setStudentWorkingId(
        null
      );
    }
  }

  /* =======================================================
     LOGOUT
  ======================================================= */

  async function handleLogout() {
    await supabase.auth.signOut();

    router.push("/login");

    router.refresh();
  }

  /* =======================================================
     LOADING
  ======================================================= */

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

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link
            href="/"
            className="shrink-0"
          >
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
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Admin Panel →
            </Link>

            <button
              type="button"
              onClick={() =>
                loadDashboard(
                  true
                )
              }
              disabled={refreshing}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              onClick={
                handleLogout
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
            Manage shops, shopkeepers and
            registered students from one control
            panel.
          </p>
        </section>

        {/* Main error */}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-bold text-red-800">
              Unable to load dashboard
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* Stats */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [
              "Students",
              stats.students,
            ],
            [
              "Shopkeepers",
              stats.shopkeepers,
            ],
            [
              "Cafes",
              stats.cafes,
            ],
            [
              "Orders",
              stats.orders,
            ],
            [
              "Payments",
              stats.payments,
            ],
          ].map(
            ([label, value]) => (
              <div
                key={String(
                  label
                )}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-500">
                  {label}
                </p>

                <p className="mt-2 text-3xl font-black text-slate-950">
                  {value}
                </p>
              </div>
            )
          )}
        </section>

        {/* Control Panel */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
              Control Panel
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Shop & Student Control
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Manage the complete multi-vendor
              system from here.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveTab(
                    "shops"
                  )
                }
                className={`rounded-xl px-5 py-3 text-sm font-bold ${
                  activeTab ===
                  "shops"
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
              >
                Software / Shop Control
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveTab(
                    "students"
                  )
                }
                className={`rounded-xl px-5 py-3 text-sm font-bold ${
                  activeTab ===
                  "students"
                    ? "bg-blue-600 text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
              >
                Student Control
              </button>
            </div>
          </div>

          {/* SHOP CONTROL */}
          {activeTab ===
            "shops" && (
            <div className="p-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <h3 className="text-xl font-black">
                    Software / Shop Control
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Create, edit, pause, hide,
                    activate or permanently
                    delete shops.
                  </p>
                </div>

                <Link
                  href="/admin/shops"
                  className="w-fit rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  + Add New Shop
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
                  <div className="rounded-2xl bg-slate-50 p-8 text-sm text-slate-500">
                    Loading shops...
                  </div>
                ) : cafes.length ===
                  0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                    <p className="text-lg font-black text-slate-900">
                      No Active Cafe Available
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                      No shop has been created yet.
                      Use Add New Shop to create the
                      first one.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {cafes.map(
                      (cafe) => (
                        <div
                          key={cafe.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                        >
                          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                            <div className="flex min-w-0 flex-col gap-5 sm:flex-row">
                              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                {cafe.logo_url ? (
                                  <img
                                    src={cafe.logo_url}
                                    alt={`${cafe.name} logo`}
                                    className="h-full w-full object-contain p-2"
                                  />
                                ) : (
                                  <span className="text-4xl" aria-hidden="true">
                                    🍽️
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-xl font-black text-slate-950">
                                  {
                                    cafe.name
                                  }
                                </h4>

                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                                    cafe.status ===
                                    "active"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : cafe.status ===
                                        "paused"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  {
                                    cafe.status
                                  }
                                </span>
                              </div>

                              <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                                <p>
                                  <strong>
                                    bKash:
                                  </strong>{" "}
                                  {cafe.bkash_number ||
                                    "Not set"}
                                </p>

                                <p>
                                  <strong>
                                    Phone:
                                  </strong>{" "}
                                  {cafe.phone_number ||
                                    "Not set"}
                                </p>

                                <p>
                                  <strong>
                                    Student visibility:
                                  </strong>{" "}
                                  {cafe.status ===
                                  "active"
                                    ? "Visible"
                                    : "Hidden"}
                                </p>

                                <p className="break-all">
                                  <strong>
                                    Shopkeeper:
                                  </strong>{" "}
                                  {cafe.shopkeeper_id ||
                                    cafe.owner_id ||
                                    "Not assigned"}
                                </p>
                              </div>
                            </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  startCafeEdit(
                                    cafe
                                  )
                                }
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  changeCafeStatus(
                                    cafe,
                                    "paused"
                                  )
                                }
                                disabled={
                                  cafeWorkingId ===
                                  cafe.id
                                }
                                className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                              >
                                Pause
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  changeCafeStatus(
                                    cafe,
                                    "hidden"
                                  )
                                }
                                disabled={
                                  cafeWorkingId ===
                                  cafe.id
                                }
                                className="rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                              >
                                Hide
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  changeCafeStatus(
                                    cafe,
                                    "active"
                                  )
                                }
                                disabled={
                                  cafeWorkingId ===
                                  cafe.id
                                }
                                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Activate / Show
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteCafe(
                                    cafe
                                  )
                                }
                                disabled={
                                  cafeWorkingId ===
                                  cafe.id
                                }
                                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Permanent Delete
                              </button>
                            </div>
                          </div>

                          {editingCafeId ===
                            cafe.id && (
                            <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-5">
                              <h5 className="text-sm font-black uppercase tracking-wider text-emerald-700">
                                Edit Shop
                              </h5>

                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <input
                                  value={
                                    editCafeName
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setEditCafeName(
                                      event.target
                                        .value
                                    )
                                  }
                                  placeholder="Shop name"
                                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                                />

                                <input
                                  value={
                                    editPhoneNumber
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setEditPhoneNumber(
                                      event.target
                                        .value
                                    )
                                  }
                                  placeholder="Phone number"
                                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                                />

                                <input
                                  value={
                                    editBkashNumber
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setEditBkashNumber(
                                      event.target
                                        .value
                                    )
                                  }
                                  placeholder="bKash number"
                                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                                />

                                <div className="md:col-span-2">
                                  <label
                                    htmlFor={`edit-logo-${cafe.id}`}
                                    className="mb-2 block text-sm font-bold text-slate-700"
                                  >
                                    Cafe Logo Image
                                  </label>

                                  <input
                                    id={`edit-logo-${cafe.id}`}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={(event) =>
                                      handleEditLogoChange(
                                        event.target.files?.[0] ?? null
                                      )
                                    }
                                    className="block w-full rounded-xl border border-slate-300 bg-white text-sm text-slate-500 file:mr-4 file:border-0 file:bg-slate-100 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-slate-700"
                                  />

                                  <p className="mt-2 text-xs text-slate-400">
                                    JPG, PNG or WebP. Maximum 5 MB. নতুন ছবি দিলে existing cafe logo replace হবে।
                                  </p>

                                  {editLogoPreview && (
                                    <div className="mt-4 flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                                      <img
                                        src={editLogoPreview}
                                        alt={`${cafe.name} logo preview`}
                                        className="h-full w-full object-contain p-2"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mt-5 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    saveCafeEdit(
                                      cafe.id
                                    )
                                  }
                                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white"
                                >
                                  Save Changes
                                </button>

                                <button
                                  type="button"
                                  onClick={
                                    cancelCafeEdit
                                  }
                                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STUDENT CONTROL */}
          {activeTab ===
            "students" && (
            <div className="p-6">
              <div>
                <h3 className="text-xl font-black">
                  Student Control
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Search students by username or
                  email, freeze/unfreeze accounts and
                  permanently delete accounts.
                </p>
              </div>

              <div className="mt-6">
                <input
                  value={
                    studentSearch
                  }
                  onChange={(
                    event
                  ) =>
                    setStudentSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search by username or email..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {studentMessage && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                  {studentMessage}
                </div>
              )}

              {studentError && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {studentError}
                </div>
              )}

              <div className="mt-6">
                {studentLoading ? (
                  <div className="rounded-2xl bg-slate-50 p-8 text-sm text-slate-500">
                    Loading students...
                  </div>
                ) : students.length ===
                  0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                    <p className="font-black text-slate-900">
                      No students found
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                      Try another username or email.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {students.map(
                      (student) => (
                        <div
                          key={
                            student.id
                          }
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                        >
                          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-lg font-black text-slate-950">
                                  {student.username
                                    ? `@${student.username}`
                                    : student.full_name ||
                                      "Student"}
                                </h4>

                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                                    student.is_frozen
                                      ? "bg-red-100 text-red-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {student.is_frozen
                                    ? "Frozen"
                                    : "Active"}
                                </span>
                              </div>

                              <p className="mt-2 text-sm text-slate-600">
                                {student.email}
                              </p>

                              {student.full_name && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {student.full_name}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setStudentFrozen(
                                    student
                                  )
                                }
                                disabled={
                                  studentWorkingId ===
                                  student.id
                                }
                                className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
                                  student.is_frozen
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-amber-500 hover:bg-amber-600"
                                }`}
                              >
                                {student.is_frozen
                                  ? "Unfreeze / Activate"
                                  : "Freeze / Pause"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteStudent(
                                    student
                                  )
                                }
                                disabled={
                                  studentWorkingId ===
                                  student.id
                                }
                                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Permanent Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Quick access */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Link
            href="/admin/shops"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
          >
            <h3 className="text-lg font-black">
              Add New Shop
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              Create a new shop and automatically
              create its shopkeeper account.
            </p>
          </Link>

          <Link
            href="/cafes"
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h3 className="text-lg font-black">
              Cafe Overview
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              View currently available cafes.
            </p>
          </Link>

          <Link
            href="/"
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h3 className="text-lg font-black">
              Public Home
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              Open the student-facing website.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}