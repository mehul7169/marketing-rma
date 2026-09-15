"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reviveDeadLeadAction } from "@/app/leads/actions";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import OrgPreviewReadOnlyNotice from "@/components/admin/OrgPreviewReadOnlyNotice";

export default function ReviveLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const preview = useOrgPreview();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (preview.active) {
    return <OrgPreviewReadOnlyNotice />;
  }

  function onRevive(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      try {
        await reviveDeadLeadAction(leadId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revive");
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onRevive}
        disabled={pending}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Reviving…" : "Revive"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
