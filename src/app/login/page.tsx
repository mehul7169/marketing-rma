"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (signInError) {
        setError("Invalid email or password");
        return;
      }

      // Hard navigation so the next request includes the fresh session cookie.
      // router.push + refresh can race middleware and leave you on a stale
      // logged-out RSC payload until a full reload.
      window.location.assign("/");
      return;
    } catch {
      setError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded border border-slate-200 p-6"
      >
        <h1 className="page-title">Log in</h1>
        <p className="text-sm text-slate-600">
          Internal dashboard — sign in to continue.
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="btn-brand w-full disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-sm text-slate-600">
          Don&apos;t have an account yet?{" "}
          <Link href="/signup" className="font-medium text-slate-900 underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
