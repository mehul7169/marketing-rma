"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { predictLogCallAttemptPatch } from "@/lib/leads/predictCallAttempt";
import type { LeadRow } from "@/lib/leads/types";
import {
  fromDatetimeLocalIST,
  toDatetimeLocalIST,
  tomorrowSameTimeLocalIST
} from "@/lib/timezone";

type PopoverKind =
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
 * Call logging uses an anchored popover (not a screen-blocking modal) with
 * optimistic updates via onLeadPatched / onLeadRollback.
 */
export default function WorkQueueLeadActions({
  lead,
  compact = false,
  showHistoryToggle = false,
  historyOpen = false,
  onToggleHistory,
  onLeadPatched,
  onLeadRollback,
  onError
}: {
  lead: LeadRow;
  compact?: boolean;
  showHistoryToggle?: boolean;
  historyOpen?: boolean;
  onToggleHistory?: () => void;
  onLeadPatched?: (patch: Partial<LeadRow>) => void;
  onLeadRollback?: (snapshot: LeadRow) => void;
  onError?: (message: string) => void;
}) {
  const preview = useOrgPreview();
  const [popover, setPopover] = useState<PopoverKind>(null);
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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!popover || !rootRef.current) {
      setCoords(null);
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const width = 288;
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - width - 8
    );
    const top = Math.min(rect.bottom + 6, window.innerHeight - 8);
    setCoords({ top, left });
  }, [popover]);

  useEffect(() => {
    if (!popover) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popoverRef.current?.contains(t)) {
        return;
      }
      setPopover(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPopover(null);
    }
    function onScroll() {
      setPopover(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [popover]);

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

  function fail(msg: string) {
    setError(msg);
    onError?.(msg);
  }

  function submitCallAttempt() {
    if (outcome === "qualified" && !callAt.trim()) {
      setError("Call date/time is required when marking Qualified");
      return;
    }
    if (outcome === "follow_up_needed" && !followUpAt.trim()) {
      setError("Follow-up time is required");
      return;
    }

    const snapshot = lead;
    const followUpIso =
      outcome === "follow_up_needed" ? fromDatetimeLocalIST(followUpAt) : null;
    const scheduledIso =
      outcome === "qualified" ? fromDatetimeLocalIST(callAt) : null;

    const optimistic = predictLogCallAttemptPatch(lead, outcome, {
      followUpAtIso: followUpIso,
      scheduledForIso: scheduledIso
    });

    setPopover(null);
    setNote("");
    setError(null);
    onLeadPatched?.(optimistic);

    void logLeadCallAttemptAction(lead.id, outcome, {
      note: note || null,
      followUpAtLocal: outcome === "follow_up_needed" ? followUpAt : null,
      scheduledForLocal: outcome === "qualified" ? callAt : null
    })
      .then((result) => {
        onLeadPatched?.(result);
      })
      .catch((err) => {
        onLeadRollback?.(snapshot);
        fail(err instanceof Error ? err.message : "Action failed");
      });
  }

  function runBackground(
    fn: () => Promise<Partial<LeadRow> | unknown>,
    optimistic?: Partial<LeadRow>
  ) {
    const snapshot = lead;
    setPopover(null);
    setNote("");
    setError(null);
    if (optimistic) onLeadPatched?.(optimistic);
    void fn()
      .then((result) => {
        if (result && typeof result === "object" && "id" in (result as object)) {
          onLeadPatched?.(result as Partial<LeadRow>);
        }
      })
      .catch((err) => {
        onLeadRollback?.(snapshot);
        fail(err instanceof Error ? err.message : "Action failed");
      });
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-3 gap-2"}`}>
        <button
          type="button"
          title="Add note"
          onClick={() => setPopover(popover === "note" ? null : "note")}
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
              setPopover(popover === "log_call" ? null : "log_call");
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
              setPopover(popover === "qualify_call" ? null : "qualify_call");
            }}
          >
            Qualify Call
          </button>
        ) : null}
        {actions.includes("show") ? (
          <button
            type="button"
            className={primaryBtn}
            onClick={() =>
              setPopover(popover === "show_outcome" ? null : "show_outcome")
            }
          >
            Log Outcome
          </button>
        ) : null}
        {actions.includes("reschedule") ? (
          <button
            type="button"
            className={secondaryBtn}
            onClick={() =>
              setPopover(popover === "reschedule" ? null : "reschedule")
            }
          >
            Reschedule
          </button>
        ) : null}
        {shouldOfferWhatsApp(lead) ? (
          <button
            type="button"
            className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-900`}
            onClick={() => setPopover(popover === "whatsapp" ? null : "whatsapp")}
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

      {popover && coords
        ? createPortal(
            <div
              ref={popoverRef}
              style={{ top: coords.top, left: coords.left }}
              className="fixed z-[70] w-72 rounded border border-slate-200 bg-white p-3 shadow-lg"
            >
              {popover === "log_call" || popover === "qualify_call" ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {popover === "qualify_call" ? "Qualify call" : "Log call"}
                  </h3>
                  <label className="block text-xs text-slate-600">
                    Outcome
                    <select
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
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
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
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
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                        value={callAt}
                        onChange={(e) => setCallAt(e.target.value)}
                      />
                    </label>
                  ) : null}
                  <label className="block text-xs text-slate-600">
                    Note (optional)
                    <textarea
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-2.5 py-1 text-sm"
                      onClick={() => setPopover(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-900 px-2.5 py-1 text-sm text-white"
                      onClick={submitCallAttempt}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : null}

              {popover === "show_outcome" ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Log show outcome</h3>
                  <select
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
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
                      className="rounded border px-2.5 py-1 text-sm"
                      onClick={() => setPopover(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-900 px-2.5 py-1 text-sm text-white"
                      onClick={() =>
                        runBackground(
                          () =>
                            logLeadShowOutcomeAction(
                              lead.id,
                              showOutcome,
                              note || null
                            ),
                          { call_showed: showOutcome === "showed" }
                        )
                      }
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : null}

              {popover === "reschedule" ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Reschedule call</h3>
                  <input
                    type="datetime-local"
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    value={rescheduleAt}
                    onChange={(e) => setRescheduleAt(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded border px-2.5 py-1 text-sm"
                      onClick={() => setPopover(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-900 px-2.5 py-1 text-sm text-white"
                      onClick={() =>
                        runBackground(() =>
                          rescheduleLeadCallAction(
                            lead.id,
                            rescheduleAt,
                            note || null
                          )
                        )
                      }
                    >
                      Reschedule
                    </button>
                  </div>
                </div>
              ) : null}

              {popover === "note" ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Add note</h3>
                  <textarea
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded border px-2.5 py-1 text-sm"
                      onClick={() => setPopover(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-900 px-2.5 py-1 text-sm text-white disabled:opacity-60"
                      disabled={!note.trim()}
                      onClick={() =>
                        runBackground(() => addLeadNoteAction(lead.id, note), {
                          last_action: note.trim(),
                          last_action_at: new Date().toISOString()
                        })
                      }
                    >
                      Save note
                    </button>
                  </div>
                </div>
              ) : null}

              {popover === "whatsapp" ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">WhatsApp nudge</h3>
                  <p className="text-xs text-slate-600">
                    Logs a whatsapp_sent activity only — no WhatsApp API yet.
                  </p>
                  <textarea
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    rows={2}
                    placeholder="Optional note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded border px-2.5 py-1 text-sm"
                      onClick={() => setPopover(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded bg-emerald-700 px-2.5 py-1 text-sm text-white"
                      onClick={() =>
                        runBackground(
                          () =>
                            sendLeadWhatsAppNudgeAction(lead.id, note || null),
                          {
                            last_action: "WhatsApp nudge sent",
                            last_action_at: new Date().toISOString()
                          }
                        )
                      }
                    >
                      Mark sent
                    </button>
                  </div>
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
