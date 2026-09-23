"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const GENERIC_SUCCESS =
  "If an account exists for that email, a reset link has been sent. Check your inbox (and spam).";

function isRateLimited(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("rate limit") ||
    m.includes("too many") ||
    m.includes("security purposes") ||
    m.includes("email rate")
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;

    setError(null);
    inFlight.current = true;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );

      if (resetError) {
        // Never reveal whether the email is registered.
        if (isRateLimited(resetError.message || "")) {
          setError(
            "Too many reset attempts. Please wait a few minutes and try again."
          );
          inFlight.current = false;
          setSubmitting(false);
          return;
        }
        // Unknown-user / other Auth errors → same generic success.
      }

      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
      inFlight.current = false;
      setSubmitting(false);
      return;
    }

    inFlight.current = false;
    setSubmitting(false);
  }

  if (done) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm space-y-4 rounded border border-slate-200 p-6">
          <h1 className="page-title">Check your email</h1>
          <p className="text-sm text-slate-600">{GENERIC_SUCCESS}</p>
          <p className="text-center text-sm text-slate-600">
            <Link href="/login" className="font-medium text-slate-900 underline">
              Back to log in
            </Link>
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
        aria-busy={submitting}
      >
        <h1 className="page-title">Forgot password</h1>
        <p className="text-sm text-slate-600">
          Enter your account email and we&apos;ll send a reset link.
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
            disabled={submitting}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          aria-disabled={submitting}
          className="btn-brand w-full disabled:pointer-events-none disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>

        <p className="text-center text-sm text-slate-600">
          <Link href="/login" className="font-medium text-slate-900 underline">
            Back to log in
          </Link>
        </p>
      </form>
    </div>
  );
}
