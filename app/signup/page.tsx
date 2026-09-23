"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

function getSafeRedirectPath(value: string | null) {
  if (!value) {
    return "/student";
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/student";
  }

  return value;
}

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const redirectPath = getSafeRedirectPath(
      new URLSearchParams(window.location.search).get("redirect")
    );

    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const cleanName = fullName.trim();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phoneNumber.trim().replace(/[\s-]/g, "");

    if (!cleanName) {
      setErrorMessage("Please enter your full name.");
      return;
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      setErrorMessage("Username must contain 3 to 30 characters.");
      return;
    }

    if (!USERNAME_PATTERN.test(cleanUsername)) {
      setErrorMessage(
        "Username may contain only letters, numbers, dot, underscore and hyphen."
      );
      return;
    }

    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setErrorMessage(
        "Please enter a valid Bangladesh mobile number, e.g. 01712345678."
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const {
      data: usernameAvailable,
      error: usernameCheckError,
    } = await supabase.rpc("check_username_available", {
      p_username: cleanUsername,
    });

    if (usernameCheckError) {
      setErrorMessage(
        "We could not validate the username right now. Please try again."
      );
      setLoading(false);
      return;
    }

    if (!usernameAvailable) {
      setErrorMessage(
        "This username is already taken. Please choose another one."
      );
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          username: cleanUsername,
          phone_number: cleanPhone,
          role: "student",
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`,
      },
    });

    if (error) {
      const message = error.message.toLowerCase();

      if (
        message.includes("username") &&
        message.includes("unique")
      ) {
        setErrorMessage(
          "This username is already taken. Please choose another one."
        );
      } else {
        setErrorMessage(error.message);
      }

      setLoading(false);
      return;
    }

    if (data.session) {
      router.push(redirectPath);
      router.refresh();
      return;
    }

    setSuccessMessage(
      "Account created successfully. Please check your email and confirm your account before logging in."
    );

    setFullName("");
    setUsername("");
    setEmail("");
    setPhoneNumber("");
    setPassword("");
    setConfirmPassword("");

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-block text-2xl font-black tracking-tight text-slate-950"
          >
            DIU <span className="text-emerald-600">Smart Cafe</span>
          </Link>

          <p className="mt-2 text-sm text-slate-500">
            Student account registration
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-9">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
            Create account
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Join DIU Smart Cafe
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Create your student account to place food pre-orders.
          </p>

          <form onSubmit={handleSignup} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="fullName"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Full Name
              </label>

              <input
                id="fullName"
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="Your full name"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Username
              </label>

              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                minLength={3}
                maxLength={30}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value.replace(/\s/g, ""));
                  setErrorMessage("");
                }}
                placeholder="e.g. mohidul_123"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />

              <p className="mt-2 text-xs text-slate-400">
                3–30 characters: letters, numbers, dot, underscore and hyphen.
              </p>
            </div>

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
                required
                autoComplete="tel"
                inputMode="numeric"
                maxLength={11}
                value={phoneNumber}
                onChange={(event) => {
                  setPhoneNumber(
                    event.target.value.replace(/[^0-9]/g, "")
                  );
                  setErrorMessage("");
                }}
                placeholder="01712345678"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />

              <p className="mt-2 text-xs text-slate-400">
                Your phone number is saved with your student profile and order.
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="your@email.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

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
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="Re-enter your password"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-7 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                href="/login?redirect=/cart"
                className="font-bold text-emerald-600 hover:text-emerald-700"
              >
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}