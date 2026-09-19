import Link from "next/link";

import CafeCard from "@/components/CafeCard";
import FoodCard from "@/components/FoodCard";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Navbar from "@/components/Navbar";
import ShopkeeperCTA from "@/components/ShopkeeperCTA";

const cafes = [
  {
    name: "Main Cafeteria",
    description: "Daily meals, snacks and student favorites",
    crowd: "Medium",
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    name: "Food Court",
    description: "Multiple food options in one place",
    crowd: "Low",
    color: "bg-blue-50 text-blue-700",
  },
  {
    name: "Other Campus Shops",
    description: "Quick bites, drinks and snacks",
    crowd: "Low",
    color: "bg-purple-50 text-purple-700",
  },
];

const foods = [
  {
    name: "Chicken Biryani",
    category: "Lunch",
    price: 120,
    cafe: "Main Cafeteria",
    available: true,
    emoji: "🍗",
  },
  {
    name: "Kacchi",
    category: "Lunch",
    price: 180,
    cafe: "Food Court",
    available: true,
    emoji: "🍛",
  },
  {
    name: "Chicken Khichuri",
    category: "Meal",
    price: 100,
    cafe: "Main Cafeteria",
    available: true,
    emoji: "🍲",
  },
  {
    name: "Beef Burger",
    category: "Fast Food",
    price: 150,
    cafe: "Food Court",
    available: false,
    emoji: "🍔",
  },
];

export default function Home() {
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
                Check different food points around campus before placing your
                order.
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

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {cafes.map((cafe) => (
              <CafeCard
                key={cafe.name}
                name={cafe.name}
                description={cafe.description}
                crowd={cafe.crowd}
                color={cafe.color}
              />
            ))}
          </div>
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

          {/* Category overview */}
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white">
              All
            </span>

            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">
              Lunch
            </span>

            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">
              Fast Food
            </span>

            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">
              Snacks
            </span>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {foods.map((food) => (
              <FoodCard
                key={food.name}
                name={food.name}
                category={food.category}
                price={food.price}
                cafe={food.cafe}
                available={food.available}
                emoji={food.emoji}
              />
            ))}
          </div>

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