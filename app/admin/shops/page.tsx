"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminShopsPage() {
  const router = useRouter();

  const [shopName, setShopName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bkashNumber, setBkashNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/shops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shopName,
          logoUrl,
          phoneNumber,
          bkashNumber,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to create shop."
        );
      }

      setMessage(
        `Shop "${data?.cafe?.name || shopName}" created successfully.`
      );

      setShopName("");
      setLogoUrl("");
      setPhoneNumber("");
      setBkashNumber("");
      setEmail("");
      setPassword("");

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
              ADMIN PANEL
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Shop Management
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Create a new shop and automatically create its
              shopkeeper account.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="w-fit rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Back to Admin
          </button>
        </div>

        {/* Main Card */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              Add New Shop
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Shopkeeper login will be created automatically from
              the information below.
            </p>
          </div>

          {/* Success Message */}
          {message && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">
                {message}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                {error}
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-8"
          >
            {/* Shop Information */}
            <section>
              <h3 className="mb-5 text-sm font-black uppercase tracking-wider text-slate-700">
                Shop Information
              </h3>

              <div className="grid gap-5 md:grid-cols-2">
                {/* Shop Name */}
                <div className="md:col-span-2">
                  <label
                    htmlFor="shopName"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    Shop Name
                  </label>

                  <input
                    id="shopName"
                    type="text"
                    value={shopName}
                    onChange={(event) =>
                      setShopName(event.target.value)
                    }
                    placeholder="Example: Main Cafeteria"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label
                    htmlFor="phoneNumber"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    Phone Number
                  </label>

                  <input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(event) =>
                      setPhoneNumber(event.target.value)
                    }
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                {/* bKash */}
                <div>
                  <label
                    htmlFor="bkashNumber"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    bKash Number
                  </label>

                  <input
                    id="bkashNumber"
                    type="tel"
                    value={bkashNumber}
                    onChange={(event) =>
                      setBkashNumber(event.target.value)
                    }
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                {/* Logo */}
                <div className="md:col-span-2">
                  <label
                    htmlFor="logoUrl"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    Logo URL
                  </label>

                  <input
                    id="logoUrl"
                    type="url"
                    value={logoUrl}
                    onChange={(event) =>
                      setLogoUrl(event.target.value)
                    }
                    placeholder="https://example.com/logo.png"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    Image URL দিলে shop logo হিসেবে ব্যবহার করা যাবে।
                  </p>
                </div>
              </div>
            </section>

            {/* Shopkeeper Account */}
            <section className="border-t border-slate-200 pt-8">
              <h3 className="mb-5 text-sm font-black uppercase tracking-wider text-slate-700">
                Shopkeeper Account
              </h3>

              <div className="space-y-5">
                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    Shopkeeper Email
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="shopkeeper@example.com"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    Password
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    Password must contain at least 8 characters.
                  </p>
                </div>
              </div>
            </section>

            {/* Automatic Setup */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-black text-blue-900">
                Automatic Setup
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-800">
                Submit করার পর system automatically Supabase Auth
                account তৈরি করবে, user-এর role{" "}
                <strong>shopkeeper</strong> করবে এবং shop-এর সাথে
                সেই account link করবে।
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => router.push("/admin")}
                disabled={loading}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Creating Shop..."
                  : "Create Shop"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}