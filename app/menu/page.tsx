import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StudentHeader from "@/components/student/StudentHeader";
import AddToCartButton from "@/components/student/AddToCartButton";

type MenuPageProps = {
  searchParams: Promise<{
    cafe?: string;
  }>;
};

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  cafe_id: string;
  cafe_name: string;
  category_name: string;
};

type RatingSummary = {
  menu_item_id: string;
  average_rating: number;
  rating_count: number;
};

export default async function MenuPage({
  searchParams,
}: MenuPageProps) {
  const params = await searchParams;
  const cafeId = params.cafe;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  let fullName: string | null = null;
  let role: "student" | "shopkeeper" | "admin" | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    username = profile?.username ?? null;
    fullName = profile?.full_name ?? null;
    role =
      (profile?.role as
        | "student"
        | "shopkeeper"
        | "admin"
        | null) ?? null;
  }

  const headerProps = {
    username,
    fullName,
    email: user?.email ?? null,
    role,
  };

  const { data: ratingData } = await supabase.rpc(
    "get_menu_item_rating_summary"
  );

  const ratingMap = new Map<string, RatingSummary>();

  for (const item of (ratingData ?? []) as RatingSummary[]) {
    ratingMap.set(item.menu_item_id, item);
  }

  if (cafeId) {
    const { data: cafe, error: cafeError } = await supabase
      .from("cafes")
      .select("id, name, logo_url, is_active, status")
      .eq("id", cafeId)
      .eq("is_active", true)
      .eq("status", "active")
      .maybeSingle();

    if (cafeError || !cafe) {
      return (
        <main className="min-h-screen bg-slate-50">
          <StudentHeader {...headerProps} />

          <div className="mx-auto max-w-7xl px-5 py-16">
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <h1 className="text-2xl font-black text-slate-950">
                Cafe not found
              </h1>

              <p className="mt-3 text-sm text-slate-500">
                This cafe is unavailable or no longer active.
              </p>

              <Link
                href="/cafes"
                className="mt-6 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Explore Cafes
              </Link>
            </div>
          </div>
        </main>
      );
    }

    const { data: menuData, error: menuError } = await supabase
      .from("menu_items")
      .select(
        `
        id,
        name,
        description,
        price,
        image_url,
        is_available,
        is_active,
        cafe_id,
        menu_categories (
          name
        )
      `
      )
      .eq("cafe_id", cafe.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (menuError) {
      return (
        <main className="min-h-screen bg-slate-50">
          <StudentHeader {...headerProps} />

          <div className="mx-auto max-w-7xl px-5 py-16">
            <div className="rounded-3xl border border-red-200 bg-white p-10 text-center shadow-sm">
              <h1 className="text-2xl font-black text-red-600">
                Unable to load menu
              </h1>

              <p className="mt-3 text-sm text-slate-500">
                {menuError.message}
              </p>
            </div>
          </div>
        </main>
      );
    }

    const items: MenuItem[] = (menuData ?? []).map((item: any) => {
      const category = Array.isArray(item.menu_categories)
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
        cafe_name: cafe.name,
        category_name: category?.name ?? "Uncategorized",
      };
    });

    return (
      <main className="min-h-screen bg-slate-50">
        <StudentHeader {...headerProps} />

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-10">
            <Link
              href="/cafes"
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              ← Back to Cafes
            </Link>

            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {cafe.logo_url ? (
                    <img
                      src={cafe.logo_url}
                      alt={`${cafe.name} logo`}
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-3xl" aria-hidden="true">
                      🍽️
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
                    Cafe Menu
                  </p>

                  <h1 className="mt-2 text-4xl font-black text-slate-950">
                    {cafe.name}
                  </h1>

                  <p className="mt-2 text-sm text-slate-500">
                    Browse the available food items and add them to your cart.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10">
          {items.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <h2 className="text-xl font-black text-slate-950">
                No food available
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                This cafe has not added any active food items yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => {
                const rating = ratingMap.get(item.id);

                return (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                        {item.category_name}
                      </p>

                      <h2 className="mt-2 text-xl font-black text-slate-950">
                        {item.name}
                      </h2>

                      {item.description && (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                          {item.description}
                        </p>
                      )}

                      <div className="mt-3">
                        {rating && rating.rating_count > 0 ? (
                          <span className="text-sm font-bold text-amber-600">
                            ★ {Number(rating.average_rating).toFixed(1)}{" "}
                            <span className="font-medium text-slate-400">
                              ({rating.rating_count})
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">
                            No ratings yet
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-xl font-black text-slate-950">
                          ৳{item.price.toFixed(2)}
                        </p>

                        {item.is_available ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            Available
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                            Sold Out
                          </span>
                        )}
                      </div>

                      <div className="mt-5">
                        <AddToCartButton
                          id={item.id}
                          name={item.name}
                          price={item.price}
                          imageUrl={item.image_url}
                          cafeId={item.cafe_id}
                          cafeName={item.cafe_name}
                          available={item.is_available}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    );
  }

  const { data: menuData, error: menuError } = await supabase
    .from("menu_items")
    .select(
      `
      id,
      name,
      description,
      price,
      image_url,
      is_available,
      is_active,
      cafe_id,
      cafes!inner (
        id,
        name,
        is_active,
        status
      ),
      menu_categories (
        name
      )
    `
    )
    .eq("is_active", true)
    .eq("cafes.is_active", true)
    .eq("cafes.status", "active")
    .order("created_at", { ascending: false });

  if (menuError) {
    return (
      <main className="min-h-screen bg-slate-50">
        <StudentHeader {...headerProps} />

        <div className="mx-auto max-w-7xl px-5 py-16">
          <div className="rounded-3xl border border-red-200 bg-white p-10 text-center shadow-sm">
            <h1 className="text-2xl font-black text-red-600">
              Unable to load menu
            </h1>

            <p className="mt-3 text-sm text-slate-500">
              {menuError.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const items: MenuItem[] = (menuData ?? []).map((item: any) => {
    const cafe = Array.isArray(item.cafes)
      ? item.cafes[0]
      : item.cafes;

    const category = Array.isArray(item.menu_categories)
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
      cafe_name: cafe?.name ?? "Unknown Cafe",
      category_name: category?.name ?? "Uncategorized",
    };
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <StudentHeader {...headerProps} />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-10">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
            Explore Menu
          </p>

          <h1 className="mt-2 text-4xl font-black text-slate-950">
            Food & Drinks
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Explore food from all active cafes. Select a cafe to order from
            that cafe.
          </p>

          <Link
            href="/cafes"
            className="mt-5 inline-flex rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Browse Cafes
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10">
        {items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-black text-slate-950">
              No food available
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              No active food items are available right now.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => {
              const rating = ratingMap.get(item.id);

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                      {item.cafe_name}
                    </p>

                    <h2 className="mt-2 text-xl font-black text-slate-950">
                      {item.name}
                    </h2>

                    {item.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                        {item.description}
                      </p>
                    )}

                    <div className="mt-3">
                      {rating && rating.rating_count > 0 ? (
                        <span className="text-sm font-bold text-amber-600">
                          ★ {Number(rating.average_rating).toFixed(1)}{" "}
                          <span className="font-medium text-slate-400">
                            ({rating.rating_count})
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">
                          No ratings yet
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-xl font-black text-slate-950">
                        ৳{item.price.toFixed(2)}
                      </p>

                      {item.is_available ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          Available
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                          Sold Out
                        </span>
                      )}
                    </div>

                    <div className="mt-5">
                      <AddToCartButton
                          id={item.id}
                          name={item.name}
                          price={item.price}
                          imageUrl={item.image_url}
                          cafeId={item.cafe_id}
                          cafeName={item.cafe_name}
                          available={item.is_available}
                        />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}