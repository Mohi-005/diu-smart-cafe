import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 lg:px-8">
        {/* Brand */}
        <Link
          href="/"
          className="group shrink-0"
          aria-label="DIU Smart Cafe Home"
        >
          <div className="text-xl font-extrabold tracking-tight text-slate-950">
            DIU{" "}
            <span className="text-emerald-600 transition group-hover:text-emerald-700">
              Smart Cafe
            </span>
          </div>

          <p className="hidden text-xs text-slate-500 sm:block">
            Smart food ordering for DIU students
          </p>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-7 text-sm font-semibold md:flex">
          <Link
            href="/"
            className="text-slate-600 transition hover:text-emerald-600"
          >
            Home
          </Link>

          <Link
            href="/cafes"
            className="text-slate-600 transition hover:text-emerald-600"
          >
            Cafes
          </Link>

          <Link
            href="/menu"
            className="text-slate-600 transition hover:text-emerald-600"
          >
            Menu
          </Link>

          <a
            href="#how-it-works"
            className="text-slate-600 transition hover:text-emerald-600"
          >
            How it works
          </a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 sm:px-4"
          >
            Login
          </Link>

          <Link
            href="/signup"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:px-5"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
