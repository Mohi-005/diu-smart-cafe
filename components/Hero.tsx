import Link from "next/link";

export default function Hero() {
  return (
    <section className="overflow-hidden bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:py-24">
        {/* Left Content */}
        <div className="flex flex-col justify-center">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Smarter food ordering at DIU
          </span>

          <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Order before your break.
            <span className="mt-1 block text-emerald-600">
              Skip the long queue.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Browse live menus from DIU cafes, check food availability and
            pre-order your meal before leaving class.
          </p>

          {/* Main Actions */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/menu"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition duration-200 hover:bg-emerald-700 hover:shadow-emerald-600/30"
            >
              Browse Menu
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              href="/cafes"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-center text-sm font-bold text-slate-700 transition duration-200 hover:border-slate-400 hover:bg-slate-50"
            >
              Explore Cafes
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-slate-200 pt-7 sm:gap-5">
            <div>
              <p className="text-2xl font-black text-slate-950">3+</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500 sm:text-xs">
                Cafe locations
              </p>
            </div>

            <div>
              <p className="text-2xl font-black text-slate-950">Live</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500 sm:text-xs">
                Menu status
              </p>
            </div>

            <div>
              <p className="text-2xl font-black text-slate-950">1</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500 sm:text-xs">
                Digital token
              </p>
            </div>
          </div>
        </div>

        {/* Recommendation Card */}
        <div className="relative flex items-center justify-center">
          <div className="absolute h-64 w-64 rounded-full bg-emerald-200/60 blur-3xl sm:h-72 sm:w-72" />

          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-200/70 sm:p-5">
            {/* Food Recommendation */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-emerald-100">
                  Today&apos;s recommendation
                </p>

                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-emerald-50 backdrop-blur">
                  Live
                </span>
              </div>

              <div className="mt-7 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-5xl backdrop-blur sm:h-24 sm:w-24 sm:text-6xl">
                🍛
              </div>

              <h2 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Chicken Biryani
              </h2>

              <p className="mt-2 text-sm text-emerald-100">
                Main Cafeteria
              </p>

              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-emerald-100">Price</p>
                  <p className="mt-1 text-xl font-black">৳120</p>
                </div>

                <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur">
                  Available
                </span>
              </div>
            </div>

            {/* Pickup Info */}
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  Estimated pickup
                </p>

                <p className="mt-1 text-sm font-black text-slate-900 sm:text-base">
                  12:45 PM
                </p>
              </div>

              <div className="text-right">
                <p className="text-[11px] font-medium text-slate-500">
                  Digital token
                </p>

                <span className="mt-1 inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                  Token #A24
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}