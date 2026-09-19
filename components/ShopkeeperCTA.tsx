import Link from "next/link";

export default function ShopkeeperCTA() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:py-20 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-10 text-white shadow-xl sm:px-10 sm:py-12 lg:px-12">
        {/* Decorative Background */}
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl"
        />

        <div
          aria-hidden="true"
          className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl"
        />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
          {/* Content */}
          <div>
            <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
              For shopkeepers
            </span>

            <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
              Manage your menu and orders from one place.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Add food items, update prices, mark food as sold out and manage
              incoming student pre-orders from a simple dashboard.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-slate-300">
              <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-2">
                Menu management
              </span>

              <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-2">
                Order management
              </span>

              <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-2">
                Payment tracking
              </span>
            </div>
          </div>

          {/* Action */}
          <div className="shrink-0">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition duration-200 hover:bg-emerald-400 hover:shadow-emerald-400/20 sm:w-auto"
            >
              Shopkeeper Login
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}