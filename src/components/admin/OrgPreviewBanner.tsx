"use client";

import { useState, useTransition } from "react";
import { clearOrgPreviewAction } from "@/app/admin/org-preview/actions";
import { OverviewPageSkeleton } from "@/components/ui/PageSkeleton";
import Spinner from "@/components/ui/Spinner";

export default function OrgPreviewBanner({ orgName }: { orgName: string }) {
  const [pending, startTransition] = useTransition();
  const [reloading, setReloading] = useState(false);

  function onExit() {
    startTransition(async () => {
      await clearOrgPreviewAction();
      setReloading(true);
      window.location.reload();
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-warning-soft bg-warning-soft px-4 py-2.5 text-sm text-warning">
        <p>
          <span className="font-semibold">Previewing: {orgName}</span>
          <span className="text-warning">
            {" "}
            — read-only. Changes are blocked until you exit preview.
          </span>
        </p>
        <button
          type="button"
          onClick={onExit}
          disabled={pending || reloading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded border border-warning bg-surface px-3 py-1 text-sm font-medium text-warning hover:bg-warning-soft disabled:opacity-60"
        >
          {pending || reloading ? <Spinner size="xs" label="Exiting" /> : null}
          {pending || reloading ? "Exiting…" : "Exit preview"}
        </button>
      </div>
      {reloading ? (
        <div className="fixed inset-0 z-[100] overflow-auto bg-surface p-6">
          <OverviewPageSkeleton />
        </div>
      ) : null}
    </>
  );
}
