"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendLeadWhatsAppNudgeAction } from "@/app/leads/actions";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import OrgPreviewReadOnlyNotice from "@/components/admin/OrgPreviewReadOnlyNotice";

export default function WhatsAppNudgeButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const preview = useOrgPreview();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (preview.active) {
    return <OrgPreviewReadOnlyNotice />;
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 disabled:opacity-60"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await sendLeadWhatsAppNudgeAction(leadId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        {pending ? "Logging…" : "WhatsApp nudge"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
