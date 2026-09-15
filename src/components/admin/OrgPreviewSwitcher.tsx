"use client";

import { useState, useTransition } from "react";
import {
  clearOrgPreviewAction,
  setOrgPreviewAction
} from "@/app/admin/org-preview/actions";

type OrgOption = { id: string; name: string };

/**
 * Platform-admin only — parent must not render this for non-admins.
 * Sets preview_org_id via server action (server also re-checks isPlatformAdmin).
 */
export default function OrgPreviewSwitcher({
  organizations,
  previewOrgId
}: {
  organizations: OrgOption[];
  previewOrgId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSelect(orgId: string) {
    setError(null);
    if (!orgId) return;
    if (orgId === previewOrgId) return;
    startTransition(async () => {
      const result = await setOrgPreviewAction(orgId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  function onExit() {
    setError(null);
    startTransition(async () => {
      const result = await clearOrgPreviewAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="org-preview-switcher">
        Preview organization
      </label>
      <select
        id="org-preview-switcher"
        className="max-w-[220px] rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 disabled:opacity-60"
        value={previewOrgId ?? ""}
        disabled={pending}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>
          Preview org…
        </option>
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      {previewOrgId ? (
        <button
          type="button"
          onClick={onExit}
          disabled={pending}
          className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-sm text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          Exit preview
        </button>
      ) : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
