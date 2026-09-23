"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ReadyState = "loading" | "ready" | "invalid";

const MIN_PASSWORD_LENGTH = 6;

/**
 * Module-level promise so React Strict Mode remounts (and any accidental
 * double-invocation) share one bootstrap — never two PKCE exchanges.
 * Keyed by the URL token so a failed attempt for one link cannot poison a
 * later valid link in the same JS realm.
 */
let recoveryBootstrap: {
  key: string;
  promise: Promise<{ ok: boolean; errorMessage?: string }>;
} | null = null;

function recoveryBootstrapKey(href: string): string {
  const url = new URL(href);
  return (
    url.searchParams.get("code") ||
    url.searchParams.get("token_hash") ||
    (url.hash.includes("access_token") ? url.hash : "") ||
    "session"
  );
}

/**
 * Recovery links from Supabase Auth land here with either:
 * - PKCE `?code=` (default for @supabase/ssr createBrowserClient), or
 * - `?token_hash=&type=recovery` (OTP verify), or
 * - hash `#access_token=&refresh_token=&type=recovery` (legacy implicit).
 *
 * Important: createBrowserClient sets detectSessionInUrl + flowType pkce, so
 * constructing the client already exchanges `?code=` during initialize().
 * Calling exchangeCodeForSession again burns the one-time verifier and yields
 * "both auth code and code verifier should be non-empty".
 */
async function establishRecoverySession(): Promise<{
  ok: boolean;
  errorMessage?: string;
}> {
  const supabase = createClient();
  const url = new URL(window.location.href);

  const oauthError =
    url.searchParams.get("error_description") ||
    url.searchParams.get("error");
  if (oauthError) {
    return { ok: false, errorMessage: oauthError };
  }

  const code = url.searchParams.get("code");
  if (code) {
    // Wait for createBrowserClient's auto PKCE exchange on initialize.
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session?.user) {
      // Init already stripped ?code= on success; normalize to pathname.
      window.history.replaceState({}, "", url.pathname);
      return { ok: true };
    }

    // Singleton client may already have been initialized on a prior page in
    // this tab (no code in URL then), so auto-detect never ran. Exchange once.
    const stillHasCode = new URL(window.location.href).searchParams.get(
      "code"
    );
    if (stillHasCode) {
      const { error } = await supabase.auth.exchangeCodeForSession(
        stillHasCode
      );
      if (error) {
        return { ok: false, errorMessage: error.message };
      }
      window.history.replaceState({}, "", url.pathname);
      return { ok: true };
    }

    // Code was present but init already tried (and failed) the exchange —
    // verifier is gone; do not attempt a second call.
    return {
      ok: false,
      errorMessage: "Link expired or invalid"
    };
  }

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash
    });
    if (error) {
      return { ok: false, errorMessage: error.message };
    }
    window.history.replaceState({}, "", url.pathname);
    return { ok: true };
  }

  // Legacy implicit recovery: tokens in the hash fragment.
  if (url.hash.includes("access_token")) {
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token
      });
      if (error) {
        return { ok: false, errorMessage: error.message };
      }
      window.history.replaceState({}, "", url.pathname);
      return { ok: true };
    }
  }

  // Already have a session (e.g. recovery cookie after exchange, or logged-in user).
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) return { ok: true };

  return { ok: false };
}

function bootstrapRecoverySession() {
  const key = recoveryBootstrapKey(window.location.href);
  if (!recoveryBootstrap || recoveryBootstrap.key !== key) {
    recoveryBootstrap = { key, promise: establishRecoverySession() };
  }
  return recoveryBootstrap.promise;
}

export default function ResetPasswordPage() {
  const [ready, setReady] = useState<ReadyState>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        const result = await bootstrapRecoverySession();
        if (!result.ok) {
          setReady("invalid");
          return;
        }
        setReady("ready");
      } catch {
        setReady("invalid");
      }
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;

    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    inFlight.current = true;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password
      });

      if (updateError) {
        const msg = (updateError.message || "").toLowerCase();
        if (
          msg.includes("session") ||
          msg.includes("expired") ||
          msg.includes("jwt")
        ) {
          setReady("invalid");
        } else {
          setError(updateError.message || "Could not update password");
        }
        inFlight.current = false;
        setSubmitting(false);
        return;
      }

      // Sign out the recovery session so login is a clean password check.
      await supabase.auth.signOut();
      // Allow a later visit with a fresh ?code= to bootstrap again.
      recoveryBootstrap = null;
      window.location.assign("/login?reset=1");
    } catch {
      setError("Could not update password. Please try again.");
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (ready === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-slate-600">Verifying reset link…</p>
      </div>
    );
  }

  if (ready === "invalid") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm space-y-4 rounded border border-slate-200 p-6">
          <h1 className="page-title">Link expired or invalid</h1>
          <p className="text-sm text-slate-600">
            This password reset link is invalid or has already been used.
            Request a new one to continue.
          </p>
          <p className="text-center text-sm text-slate-600">
            <Link
              href="/forgot-password"
              className="font-medium text-slate-900 underline"
            >
              Request a new reset link
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
        <h1 className="page-title">Set new password</h1>
        <p className="text-sm text-slate-600">
          Choose a new password for your account.
        </p>

        <div className="space-y-1">
          <label htmlFor="password" className="text-xs text-slate-600">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            disabled={submitting}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirm-password" className="text-xs text-slate-600">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            disabled={submitting}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          {submitting ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
