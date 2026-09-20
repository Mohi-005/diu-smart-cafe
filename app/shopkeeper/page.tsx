import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ShopkeeperDashboard from "./ShopkeeperDashboard";

export default async function ShopkeeperPage() {
  const supabase = await createClient();

  /* -------------------------------------------------------
     1. Get logged-in user
  ------------------------------------------------------- */

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /* -------------------------------------------------------
     2. Verify shopkeeper role
  ------------------------------------------------------- */

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">
            Unable to load dashboard
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-600">
            {profileError.message}
          </p>
        </div>
      </main>
    );
  }

  if (profile?.role !== "shopkeeper") {
    if (profile?.role === "admin") {
      redirect("/admin");
    }

    redirect("/student");
  }

  /* -------------------------------------------------------
     3. Find ONLY this shopkeeper's shop
     owner_id = authenticated user.id
  ------------------------------------------------------- */

  const { data: cafe, error: cafeError } =
    await supabase
      .from("cafes")
      .select(
        "id, name, logo_url, phone_number, bkash_number, is_active"
      )
      .eq("owner_id", user.id)
      .maybeSingle();

  /* -------------------------------------------------------
     4. No shop assigned
  ------------------------------------------------------- */

  if (cafeError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">
            Unable to load shop
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-600">
            {cafeError.message}
          </p>
        </div>
      </main>
    );
  }

  if (!cafe) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl">
            ⚠️
          </div>

          <h1 className="mt-5 text-2xl font-black text-slate-950">
            No Shop Assigned
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Your shopkeeper account is valid, but no cafe is currently
            connected to this account.
          </p>

          <p className="mt-4 text-xs font-semibold text-slate-400">
            User ID: {user.id}
          </p>
        </div>
      </main>
    );
  }

  /* -------------------------------------------------------
     5. Inactive shop protection
  ------------------------------------------------------- */

  if (!cafe.is_active) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
            🔒
          </div>

          <h1 className="mt-5 text-2xl font-black text-slate-950">
            Shop Currently Disabled
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Your shop is currently inactive. Please contact the
            administrator.
          </p>
        </div>
      </main>
    );
  }

  /* -------------------------------------------------------
     6. Render ONLY this shop's dashboard
  ------------------------------------------------------- */

  return (
    <ShopkeeperDashboard
      cafeId={cafe.id}
      cafeName={cafe.name}
    />
  );
}