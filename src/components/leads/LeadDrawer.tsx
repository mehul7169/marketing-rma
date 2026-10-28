"use client";

import { useCallback, useEffect, useState } from "react";
import { addLeadNoteAction } from "@/app/leads/actions";
import {
  loadLeadDrawer,
  type LeadDrawerPayload
} from "@/app/leads/drawer/loadDrawer";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import CopyValue from "@/components/CopyValue";
import CustomFieldsPanel from "@/components/leads/CustomFieldsPanel";
import LeadFollowUps from "@/components/leads/LeadFollowUps";
import PostCallSection from "@/components/leads/PostCallSection";
import {
  FollowUpDate,
  LeadStatusBadges,
  postCallStatusLabel
} from "@/components/leads/StageBadge";
import { useLeadDrawerParam } from "@/components/leads/useLeadDrawerParam";
import { toastError } from "@/components/ui/Toast";
import { formatCurrencyNullable } from "@/lib/format";
import { leadErrorToast } from "@/lib/leads/leadErrorToast";
import { activityTypeLabel } from "@/lib/leads/activityLabels";
import { displayLeadEmail } from "@/lib/leads/contactNormalize";
import type { BookingHistoryEntry, LeadRow } from "@/lib/leads/types";
import { formatISTDateTime } from "@/lib/timezone";

function fmtWhen(iso: string | null | undefined): string {
  return formatISTDateTime(iso);
}

function Field({
  label,
  value,
  copyable
}: {
  label: string;
  value: string | null | undefined;
  copyable?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 inline-flex items-center gap-1 text-sm text-slate-900">
        <span>{value || "—"}</span>
        {copyable ? <CopyValue value={value} /> : null}
      </div>
    </div>
  );
}

function BookingHistoryList({ entries }: { entries: BookingHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No booking history.</p>;
  }
  const ordered = [...entries].reverse();
  return (
    <ul className="space-y-2">
      {ordered.map((e, i) => (
        <li key={`${e.changed_at}-${i}`} className="text-xs text-slate-700">
          <div>
            {fmtWhen(e.previous_scheduled_for)} → {fmtWhen(e.new_scheduled_for)}
          </div>
          <div className="text-slate-500">
            {e.changed_by || "—"} · {fmtWhen(e.changed_at)}
            {e.source === "cal_com" ? " · Cal.com" : " · manual"}
          </div>
        </li>
      ))}
    </ul>
  );
}

function LeadDrawerBody({
  data,
  onReload
}: {
  data: LeadDrawerPayload;
  onReload: () => void;
}) {
  const preview = useOrgPreview();
  const { lead, activities, reminders } = data;
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  async function addNote() {
    if (preview.active) return;
    const trimmed = note.trim();
    if (!trimmed) return;
    setSavingNote(true);
    try {
      const res = await addLeadNoteAction(lead.id, trimmed);
      if (!res.ok) {
        toastError(leadErrorToast(lead, res.error));
        return;
      }
      setNote("");
      onReload();
    } catch (e) {
      toastError(
        leadErrorToast(lead, e instanceof Error ? e.message : "Save failed")
      );
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="space-y-8 pb-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {lead.name || lead.email}
          </h2>
          <LeadStatusBadges lead={lead} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Last updated {fmtWhen(lead.updated_at)}
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-slate-900">Activity</h3>
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {activities.length === 0 ? (
            <li className="text-sm text-slate-500">No activities yet.</li>
          ) : (
            activities.map((a) => (
              <li
                key={a.id}
                className="rounded border border-slate-100 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap gap-x-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-800">
                    {activityTypeLabel(a.type)}
                  </span>
                  {a.outcome ? <span>{a.outcome}</span> : null}
                  <span>{fmtWhen(a.created_at)}</span>
                  {a.actor_email ? <span>by {a.actor_email}</span> : null}
                </div>
                {a.note ? <p className="mt-1 text-sm text-slate-800">{a.note}</p> : null}
              </li>
            ))
          )}
        </ul>
        <fieldset disabled={preview.active} className="space-y-2 disabled:opacity-70">
          <label className="block text-xs text-slate-600">
            Add note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <button
            type="button"
            disabled={savingNote || !note.trim()}
            onClick={() => void addNote()}
            className="btn-brand disabled:opacity-60"
          >
            {savingNote ? "Saving…" : "Add note"}
          </button>
        </fieldset>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-slate-900">Booking history</h3>
        <BookingHistoryList entries={lead.booking_history ?? []} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-slate-900">Post-call</h3>
        <PostCallSection lead={lead} onLeadPatched={() => onReload()} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-slate-900">Follow-ups</h3>
        <LeadFollowUps
          leadId={lead.id}
          leadName={lead.name || lead.email}
          reminders={reminders}
          onChanged={onReload}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-slate-900">Locked fields</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Email"
            value={
              displayLeadEmail(lead.email) === "No email"
                ? "No email (phone-only lead)"
                : lead.email
            }
            copyable={displayLeadEmail(lead.email) !== "No email"}
          />
          <Field label="Phone" value={lead.phone} copyable />
          <Field label="Source" value={lead.lead_source} />
          <Field label="Ad set ID" value={lead.ad_set_id} />
          <Field label="UTM source" value={lead.utm_source} />
          <Field label="UTM medium" value={lead.utm_medium} />
          <Field label="UTM campaign" value={lead.utm_campaign} />
          <Field label="UTM content" value={lead.utm_content} />
          <Field label="UTM term" value={lead.utm_term} />
          <Field label="Created" value={fmtWhen(lead.created_at)} />
          <Field label="Form filled" value={fmtWhen(lead.form_filled_at)} />
          <Field label="First contacted" value={fmtWhen(lead.first_contacted_at)} />
          <Field label="Call booked" value={fmtWhen(lead.call_booked_at)} />
          <Field label="Call scheduled" value={fmtWhen(lead.call_scheduled_for)} />
          <Field
            label="Booking source"
            value={
              lead.booking_source === "manual"
                ? "Manual"
                : lead.booking_source === "cal_com"
                  ? "Cal.com"
                  : null
            }
          />
          <Field label="Cal.com booking" value={lead.cal_com_booking_id} />
          <Field label="Pipeline stage" value={lead.pipeline_stage ?? lead.stage} />
          <Field
            label="Form Qualified"
            value={
              lead.form_qualified === null
                ? null
                : lead.form_qualified
                  ? "Yes"
                  : "No"
            }
          />
          <Field label="Setter" value={lead.qualified_by} />
          <Field
            label="Deal value"
            value={formatCurrencyNullable(lead.deal_value)}
          />
          <Field
            label="Post-call status"
            value={
              lead.post_call_status
                ? postCallStatusLabel(lead.post_call_status)
                : null
            }
          />
          <div>
            <div className="text-xs text-slate-500">Follow-up date</div>
            <div className="mt-0.5 text-sm">
              <FollowUpDate at={lead.next_action_at} />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-slate-900">Form details</h3>
        <CustomFieldsPanel customFields={lead.custom_fields} />
      </section>
    </div>
  );
}

export default function LeadDrawerHost({
  onLeadPatched
}: {
  onLeadPatched?: (lead: LeadRow) => void;
} = {}) {
  const { leadId, close } = useLeadDrawerParam();
  const [payload, setPayload] = useState<LeadDrawerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    const res = await loadLeadDrawer(id);
    if (!res.ok) {
      setPayload(null);
      setError(res.error);
    } else {
      setPayload(res.data);
      onLeadPatched?.(res.data.lead);
    }
    setLoading(false);
  }, [onLeadPatched]);

  useEffect(() => {
    if (!leadId) {
      setPayload(null);
      setError(null);
      return;
    }
    void load(leadId);
  }, [leadId, load]);

  useEffect(() => {
    if (!leadId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, leadId]);

  if (!leadId) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close lead"
        className="absolute inset-0 bg-slate-900/30"
        onClick={close}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="text-sm font-medium text-slate-800">Lead</span>
          <button
            type="button"
            onClick={close}
            className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading && !payload ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : payload ? (
            <LeadDrawerBody data={payload} onReload={() => void load(payload.lead.id)} />
          ) : null}
        </div>
      </aside>
    </div>
  );
}
