"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INVITE_REQUIRED_MESSAGE =
  "This email hasn't been invited yet. Ask your admin to invite you first.";

/**
 * Project Auth setting (checked via GET /auth/v1/settings):
 * mailer_autoconfirm = false → "Confirm email" is ON.
 * Success UX: ask the user to check their inbox before logging in.
 * (If that setting were ever flipped off, signUp returns a session and we
 * redirect into the app instead.)
 */
export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      // No client-side invite pre-check — the DB trigger is the real gate.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password
      });

      if (signUpError) {
        const raw = (signUpError.message || "").toLowerCase();
        if (raw.includes("already registered")) {
          setError("An account with this email already exists. Try logging in.");
        } else {
          // Trigger rejection usually surfaces as a generic GoTrue/DB error —
          // never show raw Postgres text.
          setError(INVITE_REQUIRED_MESSAGE);
        }
        return;
      }

      if (data.session) {
        // Confirm email disabled — session is usable immediately.
        router.push("/");
        router.refresh();
        return;
      }

      // Confirm email enabled (current project setting) — must confirm first.
      setSuccess(true);
    } catch {
      setError(INVITE_REQUIRED_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm space-y-4 rounded border border-slate-200 p-6">
          <h1 className="page-title">Check your email</h1>
          <p className="text-sm text-slate-600">
            We created your account. Check your inbox for a confirmation link
            from Supabase, then{" "}
            <Link href="/login" className="font-medium text-slate-900 underline">
              log in
            </Link>{" "}
            once you&apos;ve confirmed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded border border-slate-200 p-6"
      >
        <h1 className="page-title">Sign up</h1>
        <p className="text-sm text-slate-600">
          Create an account with the email you were invited with.
        </p>

        <div className="space-y-1">
          <label htmlFor="email" className="text-xs text-slate-600">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-xs text-slate-600">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirm-password" className="text-xs text-slate-600">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="btn-brand w-full disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
