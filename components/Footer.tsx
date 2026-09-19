import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="max-w-md">
            <Link
              href="/"
              className="inline-block text-lg font-extrabold tracking-tight text-white transition hover:text-emerald-400"
            >
              DIU <span className="text-emerald-500">Smart Cafe</span>
            </Link>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              A smarter food ordering experience for DIU students.
            </p>
          </div>

          {/* Navigation */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:flex sm:gap-8">
            <Link
              href="/"
              className="transition hover:text-white"
            >
              Home
            </Link>

            <Link
              href="/cafes"
              className="transition hover:text-white"
            >
              Cafes
            </Link>

            <Link
              href="/menu"
              className="transition hover:text-white"
            >
              Menu
            </Link>

            <Link
              href="/login"
              className="transition hover:text-white"
            >
              Login
            </Link>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col gap-2 border-t border-slate-800 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 DIU Smart Cafe. All rights reserved.
          </p>

          <p className="text-slate-500">
            Built for smarter campus food ordering.
          </p>
        </div>
      </div>
    </footer>
  );
}