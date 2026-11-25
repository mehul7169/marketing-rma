"use client";

import { FormEvent, Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (signInError) {
        setError("Invalid email or password");
        inFlight.current = false;
        setSubmitting(false);
        return;
      }

      // Hard navigation so the next request includes the fresh session cookie.
      // Keep button disabled until the browser leaves this page — do not
      // re-enable in finally or duplicate clicks can fire signIn again.
      window.location.assign("/");
    } catch {
      setError("Invalid email or password");
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm space-y-4 rounded-card border border-subtle bg-surface p-6"
      aria-busy={submitting}
    >
      <h1 className="page-title">Log in</h1>
      <p className="text-sm text-muted">
        Internal dashboard — sign in to continue.
      </p>

      <div className="space-y-1">
        <label htmlFor="email" className="text-xs text-muted">
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
          className="w-full rounded border border-subtle px-3 py-2 text-sm text-fg disabled:opacity-60"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-xs text-muted">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={submitting}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-subtle px-3 py-2 text-sm text-fg disabled:opacity-60"
        />
      </div>

      {resetSuccess ? (
        <p className="text-sm text-fg">
          Password updated. Sign in with your new password.
        </p>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        aria-disabled={submitting}
        className="btn-brand w-full disabled:pointer-events-none disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        <Link
          href="/forgot-password"
          className="font-medium text-fg underline"
        >
          Forgot password?
        </Link>
      </p>

      <p className="text-center text-sm text-muted">
        Don&apos;t have an account yet?{" "}
        <Link href="/signup" className="font-medium text-fg underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Suspense
        fallback={
          <div className="w-full max-w-sm space-y-4 rounded-card border border-subtle bg-surface p-6">
            <h1 className="page-title">Log in</h1>
            <p className="text-sm text-muted">Loading…</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
