import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import CafeCard from "@/components/CafeCard";
import FoodCard from "@/components/FoodCard";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Navbar from "@/components/Navbar";
import ShopkeeperCTA from "@/components/ShopkeeperCTA";

type Cafe = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  logo_url: string | null;
};

type Food = {
  id: string;
  name: string;
  price: number;
  discount_percentage: number;
  image_url: string | null;
  is_available: boolean;
  cafe_id: string;
  category_name: string;
  cafe_name: string;
};

export default async function Home() {
  const supabase = await createClient();

  // ---------------------------------------------------------
  // Load active cafes dynamically from database
  // ---------------------------------------------------------
  const { data: cafeData, error: cafesError } = await supabase
    .from("cafes")
    .select("id, name, description, location, logo_url")
    .eq("status", "active")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(3);

  const cafes = (cafeData ?? []) as Cafe[];

  // ---------------------------------------------------------
  // Load active food items dynamically
  // ---------------------------------------------------------
  let foods: Food[] = [];

  if (cafes.length > 0) {
    const cafeIds = cafes.map((cafe) => cafe.id);

    const { data: foodData } = await supabase
      .from("menu_items")
      .select(
        `
        id,
        name,
        price,
        discount_percentage,
        image_url,
        is_available,
        cafe_id,
        menu_categories (
          name
        )
        `
      )
      .in("cafe_id", cafeIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(4);

    const cafeNameMap = new Map(
      cafes.map((cafe) => [cafe.id, cafe.name])
    );

    foods = (foodData ?? []).map((item) => {
      const categoryData = Array.isArray(item.menu_categories)
        ? item.menu_categories[0]
        : item.menu_categories;

      return {
        id: item.id,
        name: item.name,
        price: Number(item.price),
        discount_percentage: Number(item.discount_percentage ?? 0),
        image_url: item.image_url,
        is_available: item.is_available,
        cafe_id: item.cafe_id,
        category_name: categoryData?.name ?? "Uncategorized",
        cafe_name:
          cafeNameMap.get(item.cafe_id) ?? "Campus Cafe",
      };
    });
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <Navbar />

      <Hero />

      {/* Cafe Section */}
      <section
        id="cafes"
        className="scroll-mt-20 border-b border-slate-100 bg-white"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                Find your cafe
              </span>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Choose where you want to eat
              </h2>

              <p className="mt-4 text-base leading-7 text-slate-600">
                Check different food points around campus before placing
                your order.
              </p>
            </div>

            <Link
              href="/cafes"
              className="inline-flex w-fit items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
            >
              View all cafes
              <span className="ml-2 text-base">→</span>
            </Link>
          </div>

          {cafesError ? (
            <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
              <p className="font-bold">Unable to load cafes.</p>

              <p className="mt-2 text-sm">
                {cafesError.message}
              </p>
            </div>
          ) : cafes.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center">
              <p className="text-lg font-bold text-slate-950">
                No Active Cafe Available
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Please check again later.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {cafes.map((cafe) => (
                <CafeCard
                  key={cafe.id}
                  id={cafe.id}
                  name={cafe.name}
                  description={cafe.description}
                  location={cafe.location}
                  logoUrl={cafe.logo_url}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Menu Section */}
      <section
        id="menu"
        className="scroll-mt-20 bg-slate-50"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                Live menu
              </span>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                What&apos;s available today?
              </h2>

              <p className="mt-4 text-base leading-7 text-slate-600">
                Explore food and pre-order before the rush starts.
              </p>
            </div>

            <Link
              href="/menu"
              className="inline-flex w-fit items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              Explore full menu
              <span className="ml-2 text-base">→</span>
            </Link>
          </div>

          {cafes.length === 0 ? null : foods.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="text-lg font-bold text-slate-950">
                No food items are available yet.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Shopkeepers have not added any active food items yet.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {foods.map((food) => (
                <FoodCard
                  key={food.id}
                  id={food.id}
                  name={food.name}
                  category={food.category_name}
                  price={food.price}
                  cafe={food.cafe_name}
                  cafeId={food.cafe_id}
                  available={food.is_available}
                  imageUrl={food.image_url}
                  discountPercentage={food.discount_percentage}
                />
              ))}
            </div>
          )}

          <div className="mt-10 flex justify-center">
            <Link
              href="/menu"
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
            >
              See all food items
              <span className="ml-2">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Shopkeeper Section */}
      <ShopkeeperCTA />

      {/* How It Works */}
      <HowItWorks />

      <Footer />
    </main>
  );
}