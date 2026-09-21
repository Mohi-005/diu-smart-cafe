"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const error =
      params.get("error");


    if (
      error ===
      "missing_auth_code"
    ) {
      setErrorMessage(
        "The email confirmation link is missing or invalid."
      );
    }


    if (
      error ===
      "confirmation_failed"
    ) {
      setErrorMessage(
        "Email confirmation failed. Please try again or request a new confirmation email."
      );
    }


    if (error) {
      window.history.replaceState(
        {},
        "",
        "/login"
      );
    }
  }, []);


  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const supabase =
      createClient();


    /* ---------------------------------------------------
       Sign in
    --------------------------------------------------- */

    const {
      data,
      error,
    } =
      await supabase.auth.signInWithPassword({
        email:
          email.trim(),

        password,
      });


    if (error) {
      setErrorMessage(
        error.message
      );

      setLoading(false);

      return;
    }


    if (!data.user) {
      setErrorMessage(
        "Login failed. User information was not returned."
      );

      setLoading(false);

      return;
    }


    /* ---------------------------------------------------
       Profile
    --------------------------------------------------- */

    const {
      data: profile,
      error:
        profileError,
    } =
      await supabase
        .from("profiles")
        .select(
          "role, username, is_frozen"
        )
        .eq(
          "id",
          data.user.id
        )
        .maybeSingle();


    if (profileError) {
      await supabase.auth.signOut();

      setErrorMessage(
        "Your account profile could not be loaded. Please contact support."
      );

      setLoading(false);

      return;
    }


    if (!profile) {
      await supabase.auth.signOut();

      setErrorMessage(
        "Your account profile could not be found."
      );

      setLoading(false);

      return;
    }


    /* ---------------------------------------------------
       Frozen student
    --------------------------------------------------- */

    if (
      profile.role ===
        "student" &&
      profile.is_frozen
    ) {
      await supabase.auth.signOut();

      setErrorMessage(
        "Your student account is currently frozen by an administrator. Please contact the administrator before trying again."
      );

      setLoading(false);

      return;
    }


    /* ---------------------------------------------------
       Role routing
    --------------------------------------------------- */

    if (
      profile.role ===
      "shopkeeper"
    ) {
      router.push(
        "/shopkeeper"
      );

      router.refresh();

      return;
    }


    if (
      profile.role ===
      "student"
    ) {
      router.push(
        "/student"
      );

      router.refresh();

      return;
    }


    if (
      profile.role ===
      "admin"
    ) {
      router.push(
        "/admin"
      );

      router.refresh();

      return;
    }


    await supabase.auth.signOut();

    setErrorMessage(
      "Your account role is not configured correctly."
    );

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
            DIU{" "}
            <span className="text-emerald-600">
              Smart Cafe
            </span>
          </Link>

          <p className="mt-2 text-sm text-slate-500">
            Secure account login
          </p>
        </div>


        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-9">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
              Welcome back
            </p>

            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Login to DIU Smart Cafe
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Enter your email and password to continue.
            </p>
          </div>


          <form
            onSubmit={
              handleLogin
            }
            className="mt-8 space-y-5"
          >
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
                value={
                  email
                }
                onChange={(
                  event
                ) => {
                  setEmail(
                    event.target
                      .value
                  );

                  setErrorMessage(
                    ""
                  );
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
                autoComplete="current-password"
                value={
                  password
                }
                onChange={(
                  event
                ) => {
                  setPassword(
                    event.target
                      .value
                  );

                  setErrorMessage(
                    ""
                  );
                }}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>


            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                {errorMessage}
              </div>
            )}


            <button
              type="submit"
              disabled={
                loading
              }
              className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Signing in..."
                : "Login"}
            </button>
          </form>


          <div className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have a
            student account?{" "}
            <Link
              href="/signup"
              className="font-bold text-emerald-600 transition hover:text-emerald-700"
            >
              Create one
            </Link>
          </div>


          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-400 transition hover:text-slate-700"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}