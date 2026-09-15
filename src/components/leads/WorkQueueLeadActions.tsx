"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addLeadNoteAction,
  logLeadCallAttemptAction,
  logLeadShowOutcomeAction,
  rescheduleLeadCallAction,
  sendLeadWhatsAppNudgeAction
} from "@/app/leads/actions";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import OrgPreviewReadOnlyNotice from "@/components/admin/OrgPreviewReadOnlyNotice";
import {
  displayActionStatus,
  type CallAttemptOutcome
} from "@/lib/leads/actionStatus";
import type { LeadRow } from "@/lib/leads/types";
import {
  toDatetimeLocalIST,
  tomorrowSameTimeLocalIST
} from "@/lib/timezone";

type ModalKind =
  | "log_call"
  | "qualify_call"
  | "show_outcome"
  | "reschedule"
  | "note"
  | "whatsapp"
  | null;

function callPastDue(lead: LeadRow): boolean {
  if (!lead.call_scheduled_for || lead.call_showed !== null) return false;
  return new Date(lead.call_scheduled_for).getTime() < Date.now();
}

export function primaryWorkQueueActions(
  lead: LeadRow
): Array<"qualify" | "log_call" | "show" | "reschedule"> {
  const status = displayActionStatus(lead.action_status);
  const actions: Array<"qualify" | "log_call" | "show" | "reschedule"> = [];

  if (lead.call_showed === false) {
    actions.push("reschedule");
  } else if (callPastDue(lead)) {
    actions.push("show");
  } else if (
    lead.call_booked_at &&
    lead.call_confirmed !== true &&
    (status === "Call Booked" ||
      status === "Untouched" ||
      status === "Personally Contacted")
  ) {
    actions.push("qualify");
  } else if (
    status === "Untouched" ||
    status === "Personally Contacted" ||
    status === "Follow-up Due" ||
    status === "Follow-up Overdue"
  ) {
    actions.push("log_call");
  }

  return actions.slice(0, 2);
}

function shouldOfferWhatsApp(lead: LeadRow): boolean {
  const attempts = lead.contact_attempts ?? 0;
  const status = displayActionStatus(lead.action_status);
  return (
    (attempts === 1 || attempts === 3) &&
    (status === "Personally Contacted" ||
      status === "Dead" ||
      status === "Follow-up Due" ||
      status === "Follow-up Overdue")
  );
}

/**
 * Stage-driven Work Queue quick actions + Add Note.
 * Shared by card and table views.
 */
export default function WorkQueueLeadActions({
  lead,
  compact = false,
  showHistoryToggle = false,
  historyOpen = false,
  onToggleHistory
}: {
  lead: LeadRow;
  /** Tighter buttons for table rows. */
  compact?: boolean;
  showHistoryToggle?: boolean;
  historyOpen?: boolean;
  onToggleHistory?: () => void;
}) {
  const router = useRouter();
  const preview = useOrgPreview();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<ModalKind>(null);
  const [outcome, setOutcome] = useState<CallAttemptOutcome>("no_answer");
  const [showOutcome, setShowOutcome] = useState<"showed" | "no_show">("showed");
  const [note, setNote] = useState("");
  const [followUpAt, setFollowUpAt] = useState(tomorrowSameTimeLocalIST());
  const [callAt, setCallAt] = useState(
    toDatetimeLocalIST(lead.call_scheduled_for) || tomorrowSameTimeLocalIST()
  );
  const [rescheduleAt, setRescheduleAt] = useState(
    toDatetimeLocalIST(lead.call_scheduled_for) || tomorrowSameTimeLocalIST()
  );
  const [error, setError] = useState<string | null>(null);

  const actions = primaryWorkQueueActions(lead);
  const btn = compact
    ? "rounded border px-2 py-1 text-[11px] font-medium"
    : "rounded border px-3 py-1.5 text-xs font-medium";
  const primaryBtn = `${btn} border-slate-800 bg-slate-900 text-white`;
  const secondaryBtn = `${btn} border-slate-300 text-slate-800`;
  const ghostBtn = `${btn} border-slate-200 text-slate-600 hover:bg-slate-50`;

  if (preview.active) {
    return <OrgPreviewReadOnlyNotice />;
  }

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setModal(null);
        setNote("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  function submitCallAttempt() {
    if (outcome === "qualified" && !callAt.trim()) {
      setError("Call date/time is required when marking Qualified");
      return;
    }
    run(() =>
      logLeadCallAttemptAction(lead.id, outcome, {
        note: note || null,
        followUpAtLocal: outcome === "follow_up_needed" ? followUpAt : null,
        scheduledForLocal: outcome === "qualified" ? callAt : null
      })
    );
  }

  return (
    <div
      className={compact ? "flex flex-col items-start gap-1" : "contents"}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-3 gap-2"}`}>
        <button
          type="button"
          title="Add note"
          onClick={() => setModal("note")}
          className={ghostBtn}
        >
          Note
        </button>
        {actions.includes("log_call") ? (
          <button
            type="button"
            className={primaryBtn}
            onClick={() => {
              setOutcome("no_answer");
              setModal("log_call");
            }}
          >
            Log Call
          </button>
        ) : null}
        {actions.includes("qualify") ? (
          <button
            type="button"
            className={primaryBtn}
            onClick={() => {
              setOutcome("no_answer");
              setModal("qualify_call");
            }}
          >
            Qualify Call
          </button>
        ) : null}
        {actions.includes("show") ? (
          <button
            type="button"
            className={primaryBtn}
            onClick={() => setModal("show_outcome")}
          >
            Log Outcome
          </button>
        ) : null}
        {actions.includes("reschedule") ? (
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => setModal("reschedule")}
          >
            Reschedule
          </button>
        ) : null}
        {shouldOfferWhatsApp(lead) ? (
          <button
            type="button"
            className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-900`}
            onClick={() => setModal("whatsapp")}
          >
            WhatsApp
          </button>
        ) : null}
        {showHistoryToggle ? (
          <button
            type="button"
            className={ghostBtn}
            onClick={onToggleHistory}
          >
            {historyOpen ? "Hide history" : "View history"}
          </button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => !pending && setModal(null)}
        >
          <div
            className="w-full max-w-md rounded border border-slate-200 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {modal === "log_call" || modal === "qualify_call" ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {modal === "qualify_call" ? "Qualify call" : "Log call"}
                </h3>
                <label className="block text-xs text-slate-600">
                  Outcome
                  <select
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-2 text-sm"
                    value={outcome}
                    onChange={(e) =>
                      setOutcome(e.target.value as CallAttemptOutcome)
                    }
                  >
                    <option value="no_answer">No Answer</option>
                    <option value="follow_up_needed">Follow-up Needed</option>
                    <option value="qualified">Qualified</option>
                    <option value="not_qualified">Unqualified</option>
                  </select>
                </label>
                {outcome === "follow_up_needed" ? (
                  <label className="block text-xs text-slate-600">
                    Follow-up at
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-2 text-sm"
                      value={followUpAt}
                      onChange={(e) => setFollowUpAt(e.target.value)}
                    />
                  </label>
                ) : null}
                {outcome === "qualified" ? (
                  <label className="block text-xs text-slate-600">
                    Call scheduled for
                    <input
                      type="datetime-local"
                      required
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-2 text-sm"
                      value={callAt}
                      onChange={(e) => setCallAt(e.target.value)}
                    />
                  </label>
                ) : null}
                <label className="block text-xs text-slate-600">
                  Note (optional)
                  <textarea
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-2 text-sm"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-3 py-1.5 text-sm"
                    onClick={() => setModal(null)}
                    disabled={pending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
                    disabled={pending}
                    onClick={submitCallAttempt}
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ) : null}

            {modal === "show_outcome" ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Log show outcome</h3>
                <select
                  className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                  value={showOutcome}
                  onChange={(e) =>
                    setShowOutcome(e.target.value as "showed" | "no_show")
                  }
                >
                  <option value="showed">Showed</option>
                  <option value="no_show">No-Show</option>
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-sm"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        logLeadShowOutcomeAction(lead.id, showOutcome, note || null)
                      )
                    }
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ) : null}

            {modal === "reschedule" ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Reschedule call</h3>
                <input
                  type="datetime-local"
                  className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                  value={rescheduleAt}
                  onChange={(e) => setRescheduleAt(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-sm"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        rescheduleLeadCallAction(lead.id, rescheduleAt, note || null)
                      )
                    }
                  >
                    {pending ? "Saving…" : "Reschedule"}
                  </button>
                </div>
              </div>
            ) : null}

            {modal === "note" ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Add note</h3>
                <textarea
                  className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-sm"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
                    disabled={pending || !note.trim()}
                    onClick={() => run(() => addLeadNoteAction(lead.id, note))}
                  >
                    {pending ? "Saving…" : "Save note"}
                  </button>
                </div>
              </div>
            ) : null}

            {modal === "whatsapp" ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">WhatsApp nudge</h3>
                <p className="text-xs text-slate-600">
                  Logs a whatsapp_sent activity only — no WhatsApp API yet.
                </p>
                <textarea
                  className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                  rows={2}
                  placeholder="Optional note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-sm"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        sendLeadWhatsAppNudgeAction(lead.id, note || null)
                      )
                    }
                  >
                    {pending ? "Logging…" : "Mark sent"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
