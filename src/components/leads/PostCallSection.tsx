"use client";

import Link from "next/link";
import { useState } from "react";
import { saveLeadActions } from "@/app/leads/actions";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import OrgPreviewReadOnlyNotice from "@/components/admin/OrgPreviewReadOnlyNotice";
import { toastError } from "@/components/ui/Toast";
import { formatDealStatusLine } from "@/lib/deals/dealLifecycle";
import { leadErrorToast } from "@/lib/leads/leadErrorToast";
import type { LeadRow } from "@/lib/leads/types";

/** Read-only deal status in the drawer. Recording URL stays editable here. */
export default function PostCallSection({
  lead,
  onLeadPatched
}: {
  lead: LeadRow;
  onLeadPatched?: (lead: LeadRow) => void;
}) {
  const preview = useOrgPreview();
  const [saving, setSaving] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(lead.recording_url ?? "");
  const [editingRecording, setEditingRecording] = useState(!lead.recording_url);

  if (lead.call_showed !== true) return null;

  async function saveRecording() {
    setSaving(true);
    try {
      const trimmed = recordingUrl.trim();
      const updated = await saveLeadActions(lead.id, {
        recording_url: trimmed.length > 0 ? trimmed : null
      });
      setRecordingUrl(trimmed);
      setEditingRecording(trimmed.length === 0);
      onLeadPatched?.(updated);
    } catch (e) {
      toastError(
        leadErrorToast(lead, e instanceof Error ? e.message : "Save failed")
      );
    } finally {
      setSaving(false);
    }
  }

  const savedRecording = lead.recording_url?.trim() || null;
  const recordingHref = savedRecording
    ? /^https?:\/\//i.test(savedRecording)
      ? savedRecording
      : `https://${savedRecording}`
    : null;

  return (
    <div className="space-y-5">
      {preview.active ? <OrgPreviewReadOnlyNotice /> : null}
      <p className="text-sm text-fg">{formatDealStatusLine(lead)}</p>
      <p>
        <Link
          href={`/deals?deal=${lead.id}`}
          className="text-sm text-fg underline decoration-subtle underline-offset-2 hover:text-fg"
        >
          Open in Deals
        </Link>
      </p>
      <fieldset
        disabled={preview.active}
        className="min-w-0 space-y-1.5 disabled:opacity-70"
      >
        <div className="text-xs text-muted">Recording link</div>
        {savedRecording && !editingRecording && recordingHref ? (
          <div className="embed-frame flex flex-wrap items-center gap-3">
            <a
              href={recordingHref}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-full truncate text-sm text-accent-text underline decoration-subtle underline-offset-2"
            >
              {savedRecording}
            </a>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setRecordingUrl(savedRecording);
                setEditingRecording(true);
              }}
              className="text-xs text-muted underline decoration-subtle underline-offset-2 hover:text-fg"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="text"
              inputMode="url"
              placeholder="https://…"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              className="min-w-[12rem] flex-1 rounded border border-subtle px-3 py-2 text-sm text-fg"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveRecording()}
              className="btn-brand disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </fieldset>
    </div>
  );
}
