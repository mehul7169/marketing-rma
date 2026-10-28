"use client";

import { useState } from "react";
import { saveLeadActions } from "@/app/leads/actions";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import OrgPreviewReadOnlyNotice from "@/components/admin/OrgPreviewReadOnlyNotice";
import { postCallStatusLabel } from "@/components/leads/StageBadge";
import { toastError } from "@/components/ui/Toast";
import { leadErrorToast } from "@/lib/leads/leadErrorToast";
import { formatCurrencyNullable } from "@/lib/format";
import {
  POST_CALL_STATUSES,
  type PostCallStatus
} from "@/lib/leads/computeStage";
import type { LeadRow } from "@/lib/leads/types";

function TriToggle({
  label,
  value,
  onChange,
  yes = "Yes",
  no = "No",
  unset = "Not yet",
  help
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yes?: string;
  no?: string;
  unset?: string;
  help?: string;
}) {
  const btn = (v: boolean | null, text: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={`rounded border px-3 py-1.5 text-sm ${
        value === v ? "ui-active" : "border-slate-200 text-slate-700"
      }`}
    >
      {text}
    </button>
  );
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="flex flex-wrap gap-2">
        {btn(true, yes)}
        {btn(false, no)}
        {btn(null, unset)}
      </div>
      {help ? <p className="text-xs text-slate-500">{help}</p> : null}
    </div>
  );
}

function BoolToggle({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded border px-3 py-1.5 text-sm ${
            value === true ? "ui-active" : "border-slate-200 text-slate-700"
          }`}
        >
          On
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded border px-3 py-1.5 text-sm ${
            value === false ? "ui-active" : "border-slate-200 text-slate-700"
          }`}
        >
          Off
        </button>
      </div>
    </div>
  );
}

/** Post-call fields moved as-is from the detail page until the after-sales tab exists. */
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
  const [dealValue, setDealValue] = useState(
    lead.deal_value !== null && lead.deal_value !== undefined
      ? String(lead.deal_value)
      : ""
  );
  const [dealClosed, setDealClosed] = useState(lead.deal_closed);

  async function patch(input: Parameters<typeof saveLeadActions>[1]) {
    setSaving(true);
    try {
      const updated = await saveLeadActions(lead.id, input);
      onLeadPatched?.(updated);
    } catch (e) {
      toastError(
        leadErrorToast(lead, e instanceof Error ? e.message : "Save failed")
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveRecording() {
    const trimmed = recordingUrl.trim();
    await patch({ recording_url: trimmed.length > 0 ? trimmed : null });
    setRecordingUrl(trimmed);
    setEditingRecording(trimmed.length === 0);
  }

  const showPostCall = lead.call_showed === true && lead.deal_closed !== true;
  const showRecording = lead.call_showed === true;
  const afterCallReady = lead.call_showed !== null;
  const savedRecording = lead.recording_url?.trim() || null;
  const recordingHref = savedRecording
    ? /^https?:\/\//i.test(savedRecording)
      ? savedRecording
      : `https://${savedRecording}`
    : null;

  return (
    <div className="space-y-5">
      {preview.active ? <OrgPreviewReadOnlyNotice /> : null}
      <fieldset
        disabled={preview.active}
        className="min-w-0 space-y-5 disabled:opacity-70"
      >
        <BoolToggle
          label="Reminder sent"
          value={lead.reminder_sent}
          onChange={(reminder_sent) => patch({ reminder_sent })}
        />
        <div className={afterCallReady ? undefined : "opacity-55"}>
          <h3 className="section-label">After Call</h3>
          <div className="mt-3 space-y-5">
            {showPostCall ? (
              <label className="block text-xs text-slate-600">
                Post-call status
                <select
                  value={lead.post_call_status ?? ""}
                  onChange={(e) => {
                    const value = e.target.value as PostCallStatus;
                    if (!value) return;
                    void patch({ post_call_status: value });
                  }}
                  className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select status</option>
                  {POST_CALL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {postCallStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {showRecording ? (
              <div className="space-y-1.5">
                <div className="text-xs text-slate-600">Recording link</div>
                {savedRecording && !editingRecording && recordingHref ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={recordingHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="max-w-full truncate text-sm text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
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
                      className="text-xs text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
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
                      className="min-w-[12rem] flex-1 rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
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
              </div>
            ) : null}
            <TriToggle
              label="Deal"
              value={lead.deal_closed}
              yes="Won"
              no="Lost"
              unset="Not yet decided"
              onChange={(deal_closed) => {
                setDealClosed(deal_closed);
                if (deal_closed === true) {
                  const n = dealValue.trim() === "" ? null : Number(dealValue);
                  void patch({
                    deal_closed,
                    deal_value:
                      n !== null && Number.isFinite(n) ? n : lead.deal_value
                  });
                } else {
                  void patch({ deal_closed });
                }
              }}
            />
            {dealClosed === true ? (
              <label className="block text-xs text-slate-600">
                Deal value
                <input
                  type="number"
                  min={0}
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  onBlur={() => {
                    const n = dealValue.trim() === "" ? null : Number(dealValue);
                    void patch({
                      deal_value: n !== null && Number.isFinite(n) ? n : null
                    });
                  }}
                  className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
                <span className="mt-1 block text-slate-500">
                  Current: {formatCurrencyNullable(lead.deal_value)}
                </span>
              </label>
            ) : null}
          </div>
        </div>
      </fieldset>
    </div>
  );
}
