import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StudentHeader from "@/components/student/StudentHeader";
import AddToCartButton from "@/components/student/AddToCartButton";

type MenuPageProps = {
  searchParams?: Promise<{
    cafe?: string;
  }>;
};

type Cafe = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
};

export default async function MenuPage({
  searchParams,
}: MenuPageProps) {
  const params = await searchParams;
  const cafeId = params?.cafe;

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

  /*
   * If no cafe is selected, show all active cafes.
   * This allows users to enter /menu directly from the homepage.
   */
  if (!cafeId) {
    const { data: cafes, error: cafesError } = await supabase
      .from("cafes")
      .select("id, name, description, location")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (cafesError) {
      return (
        <main className="min-h-screen bg-slate-50">
          <StudentHeader
            fullName={fullName}
            email={user?.email}
          />

          <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              <p className="font-bold">
                Unable to load cafes.
              </p>

              <p className="mt-2 text-sm">
                {cafesError.message}
              </p>
            </div>
          </div>
        </main>
      );
    }

    const activeCafes = (cafes ?? []) as Cafe[];

    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <StudentHeader
          fullName={fullName}
          email={user?.email}
        />

        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <div className="rounded-3xl bg-slate-900 p-7 text-white sm:p-10">
            <Link
              href="/"
              className="text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            >
              ← Back to home
            </Link>

            <p className="mt-7 text-sm font-bold uppercase tracking-wider text-emerald-300">
              Explore menu
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              Choose a cafe
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Select a cafe to see its available food items and place
              your order.
            </p>
          </div>

          {activeCafes.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-lg font-bold text-slate-950">
                No active cafes are available.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Please check again later.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeCafes.map((cafe) => (
                <Link
                  key={cafe.id}
                  href={`/menu?cafe=${encodeURIComponent(cafe.id)}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-950">
                        {cafe.name}
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {cafe.description ||
                          "Browse this cafe's available food menu."}
                      </p>
                    </div>

                    <span className="text-2xl transition group-hover:translate-x-1">
                      →
                    </span>
                  </div>

                  {cafe.location && (
                    <p className="mt-5 text-xs font-semibold text-slate-400">
                      📍 {cafe.location}
                    </p>
                  )}

                  <div className="mt-6">
                    <span className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition group-hover:bg-emerald-600">
                      View Menu
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  // Get selected cafe
  const { data: cafe, error: cafeError } = await supabase
    .from("cafes")
    .select("id, name, description, location")
    .eq("id", cafeId)
    .eq("is_active", true)
    .maybeSingle();

  if (cafeError || !cafe) {
    return (
      <main className="min-h-screen bg-slate-50">
        <StudentHeader
          fullName={fullName}
          email={user?.email}
        />

        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <p className="font-bold">
              This cafe could not be found.
            </p>

            <p className="mt-2 text-sm">
              The selected cafe may be inactive or unavailable.
            </p>

            <Link
              href="/menu"
              className="mt-5 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700"
            >
              Browse Cafes
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Get foods ONLY from selected cafe
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      `
      id,
      name,
      description,
      price,
      image_url,
      is_available,
      cafe_id,
      menu_categories (
        name
      )
      `
    )
    .eq("cafe_id", cafe.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50">
        <StudentHeader
          fullName={fullName}
          email={user?.email}
        />

        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <p className="font-bold">
              Unable to load this cafe&apos;s menu.
            </p>

            <p className="mt-2 text-sm">
              {error.message}
            </p>

            <Link
              href="/menu"
              className="mt-5 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700"
            >
              Browse Cafes
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const foods = (data ?? []).map((item) => {
    const categoryData = Array.isArray(item.menu_categories)
      ? item.menu_categories[0]
      : item.menu_categories;

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      image_url: item.image_url,
      is_available: item.is_available,
      cafe_id: item.cafe_id,
      category_name: categoryData?.name ?? "Uncategorized",
    };
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <StudentHeader
        fullName={fullName}
        email={user?.email}
      />

      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        {/* Cafe heading */}
        <div className="rounded-3xl bg-slate-900 p-7 text-white sm:p-9">
          <Link
            href="/menu"
            className="text-sm font-semibold text-emerald-300 hover:text-emerald-200"
          >
            ← Back to cafes
          </Link>

          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
            {cafe.name}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            {cafe.description ||
              "Browse this cafe's available food menu."}
          </p>

          {cafe.location && (
            <p className="mt-4 text-xs font-semibold text-slate-400">
              📍 {cafe.location}
            </p>
          )}
        </div>

        {/* Menu heading */}
        <div className="mt-10">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
            Live menu
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Available food
          </h2>
        </div>

        {/* Food cards */}
        {foods.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-lg font-bold text-slate-950">
              No food items are listed yet.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              This cafe does not have any active menu items
              right now.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {foods.map((food) => (
              <article
                key={food.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                {/* Image */}
                <div className="h-52 overflow-hidden bg-slate-100">
                  {food.image_url ? (
                    <img
                      src={food.image_url}
                      alt={food.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-6xl">
                      🍽️
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-emerald-600">
                        {food.category_name}
                      </p>

                      <h3 className="mt-1 text-lg font-extrabold text-slate-950">
                        {food.name}
                      </h3>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        food.is_available
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {food.is_available
                        ? "Available"
                        : "Sold Out"}
                    </span>
                  </div>

                  <p className="mt-3 min-h-10 text-sm leading-5 text-slate-500">
                    {food.description ||
                      "No description available."}
                  </p>

                  <div className="mt-5 flex items-end justify-between gap-3">
                    <p className="text-xl font-black text-slate-950">
                      ৳{food.price.toFixed(2)}
                    </p>

                    <AddToCartButton
                      id={food.id}
                      name={food.name}
                      price={food.price}
                      imageUrl={food.image_url}
                      cafeId={food.cafe_id}
                      cafeName={cafe.name}
                      available={food.is_available}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}