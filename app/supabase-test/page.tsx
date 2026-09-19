import { supabase } from "@/lib/supabase";

export default async function SupabaseTestPage() {
  const { data: cafes, error } = await supabase
    .from("cafes")
    .select("id, name, description, location")
    .eq("is_active", true);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black text-slate-950">
          Supabase Database Test
        </h1>

        {error ? (
          <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">
            <p className="font-bold">Database query failed.</p>
            <p className="mt-2">{error.message}</p>
          </div>
        ) : (
          <div className="mt-5">
            <div className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              Supabase database connection is working.
            </div>

            <div className="mt-6">
              <p className="font-bold text-slate-900">
                Active cafes: {cafes?.length ?? 0}
              </p>

              {cafes && cafes.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {cafes.map((cafe) => (
                    <div
                      key={cafe.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <p className="font-bold text-slate-950">{cafe.name}</p>

                      {cafe.description && (
                        <p className="mt-1 text-sm text-slate-500">
                          {cafe.description}
                        </p>
                      )}

                      {cafe.location && (
                        <p className="mt-1 text-xs text-slate-400">
                          {cafe.location}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Database is connected, but there are currently no cafes.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}