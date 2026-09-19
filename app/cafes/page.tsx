import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StudentHeader from "@/components/student/StudentHeader";

export default async function CafesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    fullName = profile?.full_name ?? null;
  }

  const { data: cafes, error } = await supabase
    .from("cafes")
    .select("id, name, description, location")
    .eq("is_active", true)
    .order("name");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <StudentHeader
        fullName={fullName}
        email={user?.email}
      />

      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
            Choose your cafe
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Where do you want to order from?
          </h1>

          <p className="mt-4 text-base leading-7 text-slate-600">
            Select a cafeteria or food court to see only the food
            available at that location.
          </p>
        </div>

        {error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <p className="font-bold">
              Unable to load cafes.
            </p>

            <p className="mt-2">{error.message}</p>
          </div>
        ) : !cafes || cafes.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-lg font-bold text-slate-950">
              No cafes are available right now.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Please check again later.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {cafes.map((cafe) => (
              <div
                key={cafe.id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl sm:p-7"
              >
                <div className="flex items-start justify-between gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                    🍽️
                  </div>

                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    Open
                  </span>
                </div>

                <h2 className="mt-7 text-2xl font-black text-slate-950">
                  {cafe.name}
                </h2>

                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">
                  {cafe.description ||
                    "Browse the current menu and order your food."}
                </p>

                {cafe.location && (
                  <p className="mt-3 text-xs font-semibold text-slate-400">
                    📍 {cafe.location}
                  </p>
                )}

                <Link
                  href={`/menu?cafe=${cafe.id}`}
                  className="mt-7 block rounded-xl bg-slate-900 px-5 py-3.5 text-center text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  View Menu
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}