"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useCart } from "./CartProvider";
import { createClient } from "@/lib/supabase/client";

export default function CartButton() {
  const { itemCount } = useCart();
  const pathname = usePathname();

  const [canSeeCart, setCanSeeCart] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkCartVisibility() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (mounted) {
          // Guests may see the Cart button, but /cart itself still
          // requires an authenticated student and will redirect to login.
          setCanSeeCart(true);
          setCheckingRole(false);
        }

        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_frozen")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) {
        return;
      }

      setCanSeeCart(
        profile?.role === "student" &&
          profile?.is_frozen !== true
      );

      setCheckingRole(false);
    }

    checkCartVisibility();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  if (checkingRole || !canSeeCart) {
    return null;
  }

  return (
    <Link
      href="/cart"
      className="relative rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
    >
      Cart

      {itemCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-black text-white">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
