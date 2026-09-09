"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isValidNumericAdAccountIdInput,
  normalizeNumericAdAccountIdInput
} from "@/lib/clients/metaAdAccountId";

export default function AddClientAdAccountForm() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [metaId, setMetaId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const cleaned = normalizeNumericAdAccountIdInput(metaId);
    if (!isValidNumericAdAccountIdInput(cleaned)) {
      setFormError("Enter just the numeric ID, without act_");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/clients-ads/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metaAdAccountId: cleaned })
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        account?: { id: string };
      };

      if (!res.ok || !json.ok || !json.account?.id) {
        setFormError(json.error ?? "Failed to add ad account");
        return;
      }

      setMetaId("");
      setShowForm(false);
      router.push(`/clients-ads/${json.account.id}`);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setShowForm((v) => !v);
          setFormError(null);
        }}
        className="ui-btn-primary rounded px-3 py-2 text-sm"
      >
        {showForm ? "Cancel" : "Add Ad Account"}
      </button>

      {showForm ? (
        <form
          onSubmit={onSubmit}
          className="max-w-md space-y-3 rounded border border-slate-200 bg-slate-50 p-4"
        >
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Ad Account ID
            <input
              type="text"
              inputMode="numeric"
              value={metaId}
              onChange={(e) => setMetaId(e.target.value)}
              placeholder="539253822308075"
              autoComplete="off"
              spellCheck={false}
              className="rounded border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900"
            />
          </label>
          {formError ? (
            <p className="text-sm text-red-600" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="ui-btn-primary rounded px-3 py-2 text-sm disabled:opacity-60"
          >
            {submitting ? "Adding…" : "Add account"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function ClientBackfillBanner({
  accountId,
  clientName,
  initialStatus
}: {
  accountId: string;
  clientName: string;
  initialStatus: "pending" | "complete" | "error" | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus, accountId]);

  useEffect(() => {
    if (status !== "pending") return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/clients-ads/backfill-status?id=${encodeURIComponent(accountId)}`
        );
        const json = (await res.json()) as {
          status?: string;
          error?: string;
        };
        if (cancelled) return;
        if (json.status === "complete") {
          setStatus("complete");
          router.refresh();
          return;
        }
        if (json.status === "error") {
          setStatus("error");
          setError(json.error ?? "Backfill failed");
        }
      } catch {
        // keep polling
      }
    }

    void poll();
    const t = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [status, accountId, router]);

  if (status === "pending") {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Backfilling historical data for{" "}
        <span className="font-medium">{clientName}</span>…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        Backfill error{error ? `: ${error}` : ""}. The account was saved; data
        may appear after the next hourly Meta cron.
      </div>
    );
  }

  return null;
}
