"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CartButton from "./CartButton";

type StudentHeaderProps = {
  fullName?: string | null;
  email?: string | null;
};

export default function StudentHeader({
  fullName,
  email,
}: StudentHeaderProps) {
  const router = useRouter();

  const displayName =
    fullName?.trim() ||
    email?.split("@")[0] ||
    "Student";

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <p className="text-xl font-black tracking-tight text-slate-950">
            DIU{" "}
            <span className="text-emerald-600">
              Smart Cafe
            </span>
          </p>

          <p className="hidden text-xs text-slate-500 sm:block">
            Smart food ordering for DIU students
          </p>
        </Link>

        {/* Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/cafes"
            className="text-sm font-semibold text-slate-600 transition hover:text-emerald-600"
          >
            Cafes
          </Link>

          <Link
            href="/cafes"
            className="text-sm font-semibold text-slate-600 transition hover:text-emerald-600"
          >
            Menu
          </Link>

          {email && (
            <Link
              href="/student"
              className="text-sm font-semibold text-slate-600 transition hover:text-emerald-600"
            >
              My Account
            </Link>
          )}
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-2 sm:gap-3">
          <CartButton />

          {email ? (
            <>
              <div className="hidden text-right lg:block">
                <p className="text-xs font-semibold text-slate-950">
                  {displayName}
                </p>

                <p className="max-w-40 truncate text-[11px] text-slate-400">
                  {email}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:block"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}