"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminShopsPage() {
  const router = useRouter();

  const [shopName, setShopName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bkashNumber, setBkashNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleLogoChange(file: File | null) {
    setError("");

    if (!file) {
      setLogoFile(null);
      if (logoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreview);
      }
      setLogoPreview(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid cafe logo image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Cafe logo image size must be 5 MB or less.");
      return;
    }

    if (logoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreview);
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    if (!logoFile) {
      setError("Please select a cafe logo image before creating the shop.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("shopName", shopName.trim());
      formData.append("phoneNumber", phoneNumber.trim());
      formData.append("bkashNumber", bkashNumber.trim());
      formData.append("email", email.trim());
      formData.append("password", password);
      formData.append("logo", logoFile);

      const response = await fetch("/api/admin/shops", {
        method: "POST",
        body: formData,
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
      setPhoneNumber("");
      setBkashNumber("");
      setEmail("");
      setPassword("");
      handleLogoChange(null);

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
                    placeholder="Example: Campus Food Corner"
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

                {/* Cafe Logo */}
                <div className="md:col-span-2">
                  <label
                    htmlFor="logo"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    Cafe Logo Image
                  </label>

                  <input
                    id="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      handleLogoChange(
                        event.target.files?.[0] ?? null
                      )
                    }
                    required
                    className="block w-full rounded-xl border border-slate-300 bg-white text-sm text-slate-500 file:mr-4 file:border-0 file:bg-slate-100 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-slate-700"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    JPG, PNG or WebP. Maximum 5 MB. এই ছবিটিই cafe logo হিসেবে system-এর বিভিন্ন জায়গায় দেখানো হবে।
                  </p>

                  {logoPreview && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Logo Preview
                      </p>
                      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <img
                          src={logoPreview}
                          alt="Cafe logo preview"
                          className="h-full w-full object-contain p-2"
                        />
                      </div>
                    </div>
                  )}
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
