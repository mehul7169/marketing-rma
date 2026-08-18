"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BookingHistoryEntry, LeadRow } from "@/lib/leads/types";
import { saveLeadActions, saveLeadSchedule } from "@/app/leads/actions";
import { formatCurrencyNullable } from "@/lib/format";
import {
  POST_CALL_STATUSES,
  type PostCallStatus
} from "@/lib/leads/computeStage";
import { stageLabel } from "@/components/leads/StageBadge";
import { formatISTDateTime, toDatetimeLocalIST } from "@/lib/timezone";

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
          ? "border-slate-900 bg-slate-900 text-white"
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
          className={`rounded border px-3 py-1.5 text-sm ${value === true ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
        >
          {onLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded border px-3 py-1.5 text-sm ${value === false ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
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
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
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
  onSaving
}: {
  lead: LeadRow;
  saving: boolean;
  onError: (msg: string | null) => void;
  onSaving: (v: boolean) => void;
}) {
  const router = useRouter();
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
    onError(null);
    onSaving(true);
    try {
      await saveLeadSchedule(lead.id, when);
      router.refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      onSaving(false);
    }
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
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
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
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [dealValue, setDealValue] = useState(
    lead.deal_value !== null && lead.deal_value !== undefined
      ? String(lead.deal_value)
      : ""
  );
  const [dealClosed, setDealClosed] = useState(lead.deal_closed);
  const [saving, setSaving] = useState(false);

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

  const showPostCall = lead.call_showed === true && lead.deal_closed !== true;
  const afterCallReady = lead.call_showed !== null;

  return (
    <div className="space-y-8">
      <ActionSection title="Before Call">
        <TriToggle
          label="Qualified"
          value={lead.qualified}
          yes="Qualified"
          no="Unqualified"
          unset="Not yet decided"
          onChange={(qualified) => patch({ qualified })}
        />
        <BoolToggle
          label="Setter verified"
          value={lead.setter_verified}
          onLabel="Verified"
          offLabel="Unqualified"
          help="On a booked lead, mark Unqualified if the call does not actually qualify. We never delete records — this moves the lead to Dead."
          onChange={(setter_verified) => patch({ setter_verified })}
        />
        <ScheduleCall
          lead={lead}
          saving={saving}
          onError={setError}
          onSaving={setSaving}
        />
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
          onChange={(call_showed) => patch({ call_showed })}
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
                  {status === "dead" ? "Dead" : stageLabel(status)}
                </option>
              ))}
            </select>
          </label>
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
        onClick={() => patch({ notes })}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save notes"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
