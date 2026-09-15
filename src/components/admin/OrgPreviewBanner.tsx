"use client";

import { useTransition } from "react";
import { clearOrgPreviewAction } from "@/app/admin/org-preview/actions";

export default function OrgPreviewBanner({ orgName }: { orgName: string }) {
  const [pending, startTransition] = useTransition();

  function onExit() {
    startTransition(async () => {
      await clearOrgPreviewAction();
      window.location.reload();
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
      <p>
        <span className="font-semibold">Previewing: {orgName}</span>
        <span className="text-amber-800">
          {" "}
          — read-only. Changes are blocked until you exit preview.
        </span>
      </p>
      <button
        type="button"
        onClick={onExit}
        disabled={pending}
        className="shrink-0 rounded border border-amber-400 bg-white px-3 py-1 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
      >
        {pending ? "Exiting…" : "Exit preview"}
      </button>
    </div>
  );
}
