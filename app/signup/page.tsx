"use client";

import Link from "next/link";
import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router =
    useRouter();

  const [
    fullName,
    setFullName,
  ] = useState("");

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanName =
      fullName.trim();

    const cleanUsername =
      username.trim();

    const cleanEmail =
      email.trim().toLowerCase();


    /* ---------------------------------------------------
       Basic validation
    --------------------------------------------------- */

    if (!cleanName) {
      setErrorMessage(
        "Please enter your full name."
      );
      return;
    }

    if (!cleanUsername) {
      setErrorMessage(
        "Please enter a username."
      );
      return;
    }

    if (
      cleanUsername.length < 3
    ) {
      setErrorMessage(
        "Username must contain at least 3 characters."
      );
      return;
    }

    if (
      cleanUsername.length > 30
    ) {
      setErrorMessage(
        "Username must contain at most 30 characters."
      );
      return;
    }

    if (
      !/^[A-Za-z0-9_.-]+$/.test(
        cleanUsername
      )
    ) {
      setErrorMessage(
        "Username may contain only letters, numbers, dot, underscore and hyphen."
      );
      return;
    }

    if (!cleanEmail) {
      setErrorMessage(
        "Please enter your email address."
      );
      return;
    }

    if (
      password.length < 6
    ) {
      setErrorMessage(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setErrorMessage(
        "Passwords do not match."
      );
      return;
    }


    setLoading(true);

    const supabase =
      createClient();


    /* ---------------------------------------------------
       Username availability
    --------------------------------------------------- */

    const {
      data:
        usernameAvailable,
      error:
        usernameCheckError,
    } =
      await supabase.rpc(
        "check_username_available",
        {
          p_username:
            cleanUsername,
        }
      );

    if (
      usernameCheckError
    ) {
      setErrorMessage(
        usernameCheckError.message
      );

      setLoading(false);
      return;
    }

    if (
      usernameAvailable !==
      true
    ) {
      setErrorMessage(
        "This username is already taken. Please choose another one."
      );

      setLoading(false);
      return;
    }


    /* ---------------------------------------------------
       Create Auth account
    --------------------------------------------------- */

    const {
      data,
      error,
    } =
      await supabase.auth.signUp({
        email:
          cleanEmail,

        password,

        options: {
          data: {
            full_name:
              cleanName,

            username:
              cleanUsername,

            role:
              "student",
          },

          emailRedirectTo:
            `${window.location.origin}/auth/callback?next=/student`,
        },
      });


    if (error) {
      setErrorMessage(
        error.message
      );

      setLoading(false);
      return;
    }


    /* ---------------------------------------------------
       If email confirmation is disabled
    --------------------------------------------------- */

    if (data.session) {
      router.push(
        "/student"
      );

      router.refresh();

      return;
    }


    /* ---------------------------------------------------
       Email confirmation required
    --------------------------------------------------- */

    setSuccessMessage(
      "Account created successfully. Please check your email and confirm your account before logging in."
    );

    setFullName("");
    setUsername("");
    setEmail("");
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
            DIU{" "}
            <span className="text-emerald-600">
              Smart Cafe
            </span>
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


          <form
            onSubmit={
              handleSignup
            }
            className="mt-8 space-y-5"
          >
            {/* Full Name */}
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
                value={
                  fullName
                }
                onChange={(
                  event
                ) => {
                  setFullName(
                    event.target
                      .value
                  );

                  setErrorMessage(
                    ""
                  );
                }}
                placeholder="Your full name"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>


            {/* Username */}
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
                value={
                  username
                }
                onChange={(
                  event
                ) => {
                  setUsername(
                    event.target
                      .value
                  );

                  setErrorMessage(
                    ""
                  );
                }}
                placeholder="example: mohidul_01"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />

              <p className="mt-2 text-xs leading-5 text-slate-400">
                3–30 characters. Letters,
                numbers, dot, underscore and
                hyphen are allowed.
              </p>
            </div>


            {/* Email */}
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
                required
                autoComplete="new-password"
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
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>


            {/* Confirm Password */}
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
                value={
                  confirmPassword
                }
                onChange={(
                  event
                ) => {
                  setConfirmPassword(
                    event.target
                      .value
                  );

                  setErrorMessage(
                    ""
                  );
                }}
                placeholder="Re-enter your password"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>


            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                {errorMessage}
              </div>
            )}


            {successMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
                {successMessage}
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
                ? "Creating account..."
                : "Create Account"}
            </button>
          </form>


          <div className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-emerald-600 transition hover:text-emerald-700"
            >
              Login
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