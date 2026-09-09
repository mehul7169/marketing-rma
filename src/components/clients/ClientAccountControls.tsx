"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  removeClientAdAccount,
  renameClientAdAccount
} from "@/app/clients-ads/actions";

export function ClientNameEditor({
  accountId,
  initialName
}: {
  accountId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialName);
    setDraft(initialName);
  }, [initialName]);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Client name is required");
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await renameClientAdAccount(accountId, trimmed);
      setName(result.client_name);
      setDraft(result.client_name);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="page-title">{name}</h1>
        <button
          type="button"
          onClick={() => {
            setDraft(name);
            setEditing(true);
            setError(null);
          }}
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          Edit name
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs text-slate-600">
          Client name
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-lg font-semibold text-slate-900"
            autoFocus
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="ui-btn-primary rounded px-3 py-2 text-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setDraft(name);
            setEditing(false);
            setError(null);
          }}
          className="rounded border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function DeleteClientAccountButton({
  accountId,
  clientName
}: {
  accountId: string;
  clientName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setDeleting(true);
    setError(null);
    try {
      await removeClientAdAccount(accountId);
      router.push("/clients-ads");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
        >
          Delete Account
        </button>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-3 rounded border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-900">
        Delete <span className="font-medium">{clientName}</span>? This removes the
        account from the registry. Historical Meta spend rows are kept.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={deleting}
          onClick={() => void onDelete()}
          className="rounded bg-red-700 px-3 py-2 text-sm text-white hover:bg-red-800 disabled:opacity-60"
        >
          {deleting ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={() => setConfirming(false)}
          className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
