"use client";

import { useOrgPreview } from "@/components/admin/OrgPreviewContext";

/** Visible reason when CRM actions are disabled under org preview. */
export default function OrgPreviewReadOnlyNotice({
  className = ""
}: {
  className?: string;
}) {
  const preview = useOrgPreview();
  if (!preview.active) return null;
  return (
    <p
      className={`rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 ${className}`}
    >
      {preview.readOnlyMessage}
    </p>
  );
}
