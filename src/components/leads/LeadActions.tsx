"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  DEAD_REASON_CODES,
  deadReasonLabel,
  type BookingHistoryEntry,
  type DeadReasonCode,
  type LeadRow
} from "@/lib/leads/types";
import {
  leadLifecycleAction,
  saveLeadActions,
  saveLeadPlainFieldsAction
} from "@/app/leads/actions";
import type { LifecycleAction, LifecyclePayload } from "@/lib/leads/lifecycle";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import OrgPreviewReadOnlyNotice from "@/components/admin/OrgPreviewReadOnlyNotice";
import { formatCurrencyNullable } from "@/lib/format";
import {
  POST_CALL_STATUSES,
  type PostCallStatus
} from "@/lib/leads/computeStage";
import { stageLabel } from "@/components/leads/StageBadge";
import { formatISTDateTime, fromDatetimeLocalIST, toDatetimeLocalIST } from "@/lib/timezone";

type RunLifecycle = (action: LifecycleAction, payload?: LifecyclePayload) => Promise<void>;

/** Short reason prompt for clearing a milestone; null when the user cancels. */
function askReason(question: string): string | null {
  const reason = window.prompt(question)?.trim();
  return reason ? reason : null;
}

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
        value === v
          ? "ui-active"
          : "border-slate-200 text-slate-700"
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
  onChange,
  onLabel = "On",
  offLabel = "Off",
  help
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded border px-3 py-1.5 text-sm ${value === true ? "ui-active" : "border-slate-200 text-slate-700"}`}
        >
          {onLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded border px-3 py-1.5 text-sm ${value === false ? "ui-active" : "border-slate-200 text-slate-700"}`}
        >
          {offLabel}
        </button>
      </div>
      {help ? <p className="text-xs text-slate-500">{help}</p> : null}
    </div>
  );
}

function ActionSection({
  title,
  muted,
  children
}: {
  title: string;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={muted ? "opacity-55" : undefined}>
      <h3 className="section-label">
        {title}
      </h3>
      <div className="mt-3 space-y-5">{children}</div>
    </div>
  );
}

function ScheduleCall({
  lead,
  saving,
  onError,
  run
}: {
  lead: LeadRow;
  saving: boolean;
  onError: (msg: string | null) => void;
  run: RunLifecycle;
}) {
  const [when, setWhen] = useState(toDatetimeLocalIST(lead.call_scheduled_for));
  const [historyOpen, setHistoryOpen] = useState(false);
  const hasBooking = Boolean(lead.call_scheduled_for || lead.call_booked_at);
  const history = lead.booking_history ?? [];
  const rescheduleCount = history.filter((e) => e.previous_scheduled_for).length;

  async function save() {
    if (!when) {
      onError("Pick a date and time for the call.");
      return;
    }
    await run(lead.call_booked_at ? "reschedule_call" : "book_call", {
      scheduledFor: fromDatetimeLocalIST(when)
    });
  }

  async function cancel() {
    const reason = askReason("Why is this call being cancelled?");
    if (reason) await run("cancel_call", { reason });
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-600">
        {hasBooking ? "Reschedule Call" : "Schedule Call"}
      </div>
      <p className="text-sm text-slate-900">
        Currently scheduled:{" "}
        <span className="font-medium">
          {formatISTDateTime(lead.call_scheduled_for)}
        </span>
        {lead.booking_source ? (
          <span className="ml-1 text-xs text-slate-500">
            ({lead.booking_source === "manual" ? "manual" : "Cal.com"})
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-slate-600">
          Date & time (IST)
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-1 rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <button
          type="button"
          disabled={saving || !when}
          onClick={save}
          className="btn-brand disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {lead.call_booked_at ? (
          <button
            type="button"
            disabled={saving}
            onClick={cancel}
            className="text-xs text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            Cancel call
          </button>
        ) : null}
      </div>
      {rescheduleCount > 0 || history.length > 1 ? (
        <div>
          <button
            type="button"
            className="text-xs text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            Rescheduled {Math.max(rescheduleCount, history.length - 1)} time
            {Math.max(rescheduleCount, history.length - 1) === 1 ? "" : "s"}
          </button>
          {historyOpen ? <BookingHistoryList entries={history} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function BookingHistoryList({ entries }: { entries: BookingHistoryEntry[] }) {
  const ordered = [...entries].reverse();
  return (
    <ul className="mt-2 space-y-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
      {ordered.map((e, i) => (
        <li key={`${e.changed_at}-${i}`} className="text-xs text-slate-700">
          <div>
            {formatISTDateTime(e.previous_scheduled_for)} →{" "}
            {formatISTDateTime(e.new_scheduled_for)}
          </div>
          <div className="text-slate-500">
            {e.changed_by || "—"} · {formatISTDateTime(e.changed_at)}
            {e.source === "cal_com" ? " · Cal.com" : " · manual"}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function LeadActions({ lead }: { lead: LeadRow }) {
  const router = useRouter();
  const preview = useOrgPreview();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [recordingUrl, setRecordingUrl] = useState(lead.recording_url ?? "");
  const [editingRecording, setEditingRecording] = useState(!lead.recording_url);
  const [dealValue, setDealValue] = useState(
    lead.deal_value !== null && lead.deal_value !== undefined
      ? String(lead.deal_value)
      : ""
  );
  const [dealClosed, setDealClosed] = useState(lead.deal_closed);
  const [saving, setSaving] = useState(false);

  const run: RunLifecycle = async (action, payload = {}) => {
    setError(null);
    setSaving(true);
    try {
      const res = await leadLifecycleAction(lead.id, action, payload);
      if (res.ok) router.refresh();
      else setError(res.error);
    } finally {
      setSaving(false);
    }
  };

  async function onQualifiedChange(value: boolean | null) {
    if (value === true) return run("qualify");
    if (value === false) {
      if (window.confirm("Marking Unqualified also moves this lead to Dead. Continue?")) {
        await run("disqualify");
      }
      return;
    }
    const reason = askReason("Why are you clearing the qualification?");
    if (reason) await run("clear_qualification", { reason });
  }

  async function onShowedChange(value: boolean | null) {
    if (value === true) return run("mark_showed");
    if (value === false) {
      if (window.confirm("Marking No-show also moves this lead to Dead. Continue?")) {
        await run("mark_no_show");
      }
      return;
    }
    const reason = askReason("Why are you clearing the show outcome?");
    if (reason) await run("clear_show", { reason });
  }

  async function saveNotes() {
    setError(null);
    setSaving(true);
    try {
      const res = await saveLeadPlainFieldsAction(lead.id, { notes });
      if (res.ok) router.refresh();
      else setError(res.error);
    } finally {
      setSaving(false);
    }
  }

  async function patch(input: Parameters<typeof saveLeadActions>[1]) {
    setError(null);
    setSaving(true);
    try {
      await saveLeadActions(lead.id, input);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
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
    <div className="space-y-8">
      {preview.active ? <OrgPreviewReadOnlyNotice /> : null}
      <fieldset disabled={preview.active} className="min-w-0 space-y-8 disabled:opacity-70">
      <ActionSection title="Before Call">
        <TriToggle
          label="Qualified"
          value={lead.qualified}
          yes="Qualified"
          no="Unqualified"
          unset="Not yet decided"
          help="Unqualified moves the lead to Dead."
          onChange={onQualifiedChange}
        />
        <ScheduleCall lead={lead} saving={saving} onError={setError} run={run} />
        <BoolToggle
          label="Reminder sent"
          value={lead.reminder_sent}
          onChange={(reminder_sent) => patch({ reminder_sent })}
        />
      </ActionSection>

      <div className="border-t border-slate-200" />

      <ActionSection title="After Call" muted={!afterCallReady}>
        <TriToggle
          label="Call showed"
          value={lead.call_showed}
          yes="Showed"
          no="No-show"
          unset="Not yet happened"
          help="No-show moves the lead to Dead."
          onChange={onShowedChange}
        />
        {showPostCall ? (
          <label className="block text-xs text-slate-600">
            Post-call status
            <select
              value={lead.post_call_status ?? ""}
              onChange={(e) => {
                const value = e.target.value as PostCallStatus;
                if (!value) return;
                patch({ post_call_status: value });
              }}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Select status</option>
              {POST_CALL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {stageLabel(status)}
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
                  className="min-w-[16rem] flex-1 rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveRecording}
                  className="btn-brand disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                {savedRecording ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setRecordingUrl(savedRecording);
                      setEditingRecording(false);
                    }}
                    className="text-xs text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                ) : null}
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
              patch({
                deal_closed,
                deal_value: n !== null && Number.isFinite(n) ? n : lead.deal_value
              });
            } else {
              patch({ deal_closed });
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
                patch({ deal_value: n !== null && Number.isFinite(n) ? n : null });
              }}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-slate-500">
              Current: {formatCurrencyNullable(lead.deal_value)}
            </span>
          </label>
        ) : null}
      </ActionSection>

      <div className="border-t border-slate-200" />

      <label className="block text-xs text-slate-600">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
        />
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={saveNotes}
        className="btn-brand disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save notes"}
      </button>
      <div className="border-t border-slate-200" />

      <MarkDead lead={lead} saving={saving} run={run} />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </fieldset>
    </div>
  );
}

function MarkDead({ lead, saving, run }: { lead: LeadRow; saving: boolean; run: RunLifecycle }) {
  const [reason, setReason] = useState<DeadReasonCode | "">("");

  if (lead.is_dead) {
    return (
      <p className="text-sm text-slate-600">
        Dead{lead.dead_reason ? `: ${deadReasonLabel(lead.dead_reason)}` : ""}. Use Revive to bring it back.
      </p>
    );
  }

  async function markDead() {
    const warning =
      lead.call_showed === true
        ? "This lead showed up for a call. Mark it dead anyway?"
        : lead.call_booked_at
          ? "This lead has a booked call. Mark it dead anyway?"
          : null;
    if (warning && !window.confirm(warning)) return;
    await run("mark_dead", { deadReason: reason || null });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col text-xs text-slate-600">
        Dead reason (optional)
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as DeadReasonCode | "")}
          className="mt-1 rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
        >
          <option value="">No reason</option>
          {DEAD_REASON_CODES.map((code) => (
            <option key={code} value={code}>
              {deadReasonLabel(code)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={markDead}
        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:opacity-60"
      >
        Mark dead
      </button>
    </div>
  );
}
