"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { leadLifecycleAction } from "@/app/leads/actions";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import OrgPreviewReadOnlyNotice from "@/components/admin/OrgPreviewReadOnlyNotice";
import { toastError } from "@/components/ui/Toast";
import { leadErrorToast } from "@/lib/leads/leadErrorToast";
import type { LeadRow } from "@/lib/leads/types";

export default function ReviveLeadButton({
  leadId,
  lead
}: {
  leadId: string;
  lead?: Pick<LeadRow, "name" | "email">;
}) {
  const router = useRouter();
  const preview = useOrgPreview();
  const [pending, startTransition] = useTransition();

  if (preview.active) {
    return <OrgPreviewReadOnlyNotice />;
  }

  function onRevive(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const res = await leadLifecycleAction(leadId, "revive");
      if (res.ok) router.refresh();
      else toastError(leadErrorToast(lead ?? {}, res.error));
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onRevive}
        disabled={pending}
        className="rounded border border-subtle bg-surface px-2 py-1 text-xs font-medium text-fg hover:bg-surface-2 disabled:opacity-60"
      >
        {pending ? "Reviving…" : "Revive"}
      </button>
    </div>
  );
}
