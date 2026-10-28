"use client";

import { useState } from "react";
import { addLeadNoteAction, leadLifecycleAction } from "@/app/leads/actions";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import OrgPreviewReadOnlyNotice from "@/components/admin/OrgPreviewReadOnlyNotice";
import ActionPopover from "@/components/leads/ActionPopover";
import { toastError } from "@/components/ui/Toast";
import { leadErrorToast } from "@/lib/leads/leadErrorToast";
import { needsQualification, pipelineStageOf } from "@/lib/leads/lifecycleDefinitions";
import type { LogCallOutcome } from "@/lib/leads/lifecycle";
import type { LifecycleResult } from "@/lib/leads/updateLeadLifecycle";
import { predictLogCallAttemptPatch } from "@/lib/leads/predictCallAttempt";
import type { LeadRow } from "@/lib/leads/types";
import {
  formatISTDateTime,
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
  | null;

function callPastDue(lead: LeadRow): boolean {
  if (!lead.call_scheduled_for || lead.call_showed !== null) return false;
  return new Date(lead.call_scheduled_for).getTime() < Date.now();
}

export function primaryWorkQueueActions(
  lead: LeadRow
): Array<"qualify" | "log_call" | "show" | "reschedule"> {
  if (lead.is_dead) return [];
  if (lead.call_showed === false) return ["reschedule"];
  if (callPastDue(lead)) return ["show"];
  const stage = pipelineStageOf(lead);
  if (stage === "call_booked") return needsQualification(lead) ? ["qualify"] : [];
  if (stage === "showed_up") return [];
  return ["log_call"];
}

function PopoverFooter({
  onCancel,
  onSave,
  saveLabel,
  saveDisabled
}: {
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  saveDisabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        className="rounded border border-slate-200 px-2.5 py-1 text-sm"
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        className="rounded bg-slate-900 px-2.5 py-1 text-sm text-white disabled:opacity-60"
        disabled={saveDisabled}
        onClick={onSave}
      >
        {saveLabel}
      </button>
    </div>
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
  onSaveStart,
  onSaveEnd,
  onError
}: {
  lead: LeadRow;
  compact?: boolean;
  showHistoryToggle?: boolean;
  historyOpen?: boolean;
  onToggleHistory?: () => void;
  onLeadPatched?: (patch: Partial<LeadRow>) => void;
  onLeadRollback?: (snapshot: LeadRow) => void;
  onSaveStart?: () => void;
  /** ok=true after successful save; ok=false after failure/rollback. */
  onSaveEnd?: (ok: boolean) => void;
  onError?: (message: string) => void;
}) {
  const preview = useOrgPreview();
  const [popover, setPopover] = useState<PopoverKind>(null);
  const [outcome, setOutcome] = useState<LogCallOutcome>("no_answer");
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

  function fail(msg: string) {
    toastError(leadErrorToast(lead, msg));
    onError?.(msg);
  }

  function submitCallAttempt() {
    const alreadyScheduled = Boolean(lead.call_scheduled_for);
    if (outcome === "qualified" && !alreadyScheduled && !callAt.trim()) {
      setError("Call date/time is required when marking Qualified");
      return;
    }
    if (outcome === "follow_up_needed" && !followUpAt.trim()) {
      setError("Follow-up time is required");
      return;
    }

    const followUpIso =
      outcome === "follow_up_needed" ? fromDatetimeLocalIST(followUpAt) : null;
    const scheduledIso =
      outcome === "qualified"
        ? alreadyScheduled
          ? lead.call_scheduled_for
          : fromDatetimeLocalIST(callAt)
        : null;

    const optimistic = predictLogCallAttemptPatch(lead, outcome, {
      followUpAtIso: followUpIso,
      scheduledForIso: scheduledIso
    });

    runBackground(
      () =>
        leadLifecycleAction(lead.id, "log_call_attempt", {
          outcome,
          note: note || null,
          followUpAt: followUpIso,
          scheduledFor: outcome === "qualified" && !alreadyScheduled ? scheduledIso : null
        }),
      optimistic ?? undefined
    );
  }

  function runBackground(fn: () => Promise<LifecycleResult>, optimistic?: Partial<LeadRow>) {
    const snapshot = lead;
    setPopover(null);
    setNote("");
    setError(null);
    if (optimistic) onLeadPatched?.(optimistic);
    onSaveStart?.();
    const rollback = (message: string) => {
      onLeadRollback?.(snapshot);
      onSaveEnd?.(false);
      fail(message);
    };
    void fn()
      .then((result) => {
        if (!result.ok) return rollback(result.error);
        onLeadPatched?.(result.lead);
        onSaveEnd?.(true);
      })
      .catch((err) => rollback(err instanceof Error ? err.message : "Action failed"));
  }

  function toggle(kind: Exclude<PopoverKind, null>) {
    setPopover((current) => (current === kind ? null : kind));
  }

  const callForm = (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900">
        {popover === "qualify_call" ? "Qualify call" : "Log call"}
      </h3>
      <label className="block text-xs text-slate-600">
        Outcome
        <select
          className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as LogCallOutcome)}
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
      {outcome === "qualified" && !lead.call_scheduled_for ? (
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
      {outcome === "qualified" && lead.call_scheduled_for ? (
        <p className="text-xs text-slate-500">
          Keeping scheduled time: {formatISTDateTime(lead.call_scheduled_for)}
        </p>
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
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-3 gap-2"}`}>
        <ActionPopover
          open={popover === "note"}
          onOpenChange={(next) => setPopover(next ? "note" : null)}
          trigger={
            <button
              type="button"
              title="Add note"
              onClick={() => toggle("note")}
              className={ghostBtn}
            >
              Note
            </button>
          }
          footer={
            <PopoverFooter
              onCancel={() => setPopover(null)}
              onSave={() =>
                runBackground(() => addLeadNoteAction(lead.id, note), {
                  last_action: note.trim(),
                  last_action_at: new Date().toISOString()
                })
              }
              saveLabel="Save note"
              saveDisabled={!note.trim()}
            />
          }
        >
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Add note</h3>
            <textarea
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </ActionPopover>
        {actions.includes("log_call") ? (
          <ActionPopover
            open={popover === "log_call"}
            onOpenChange={(next) => setPopover(next ? "log_call" : null)}
            trigger={
              <button
                type="button"
                className={primaryBtn}
                onClick={() => {
                  setOutcome("no_answer");
                  toggle("log_call");
                }}
              >
                Log Call
              </button>
            }
            footer={
              <PopoverFooter
                onCancel={() => setPopover(null)}
                onSave={submitCallAttempt}
                saveLabel="Save"
              />
            }
          >
            {callForm}
          </ActionPopover>
        ) : null}
        {actions.includes("qualify") ? (
          <ActionPopover
            open={popover === "qualify_call"}
            onOpenChange={(next) => setPopover(next ? "qualify_call" : null)}
            trigger={
              <button
                type="button"
                className={primaryBtn}
                onClick={() => {
                  setOutcome("no_answer");
                  toggle("qualify_call");
                }}
              >
                Qualify Call
              </button>
            }
            footer={
              <PopoverFooter
                onCancel={() => setPopover(null)}
                onSave={submitCallAttempt}
                saveLabel="Save"
              />
            }
          >
            {callForm}
          </ActionPopover>
        ) : null}
        {actions.includes("show") ? (
          <ActionPopover
            open={popover === "show_outcome"}
            onOpenChange={(next) => setPopover(next ? "show_outcome" : null)}
            trigger={
              <button
                type="button"
                className={primaryBtn}
                onClick={() => toggle("show_outcome")}
              >
                Log Outcome
              </button>
            }
            footer={
              <PopoverFooter
                onCancel={() => setPopover(null)}
                onSave={() =>
                  runBackground(
                    () =>
                      leadLifecycleAction(
                        lead.id,
                        showOutcome === "showed" ? "mark_showed" : "mark_no_show",
                        { note: note || null }
                      ),
                    { call_showed: showOutcome === "showed" }
                  )
                }
                saveLabel="Save"
              />
            }
          >
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
            </div>
          </ActionPopover>
        ) : null}
        {actions.includes("reschedule") ? (
          <ActionPopover
            open={popover === "reschedule"}
            onOpenChange={(next) => setPopover(next ? "reschedule" : null)}
            trigger={
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => toggle("reschedule")}
              >
                Reschedule
              </button>
            }
            footer={
              <PopoverFooter
                onCancel={() => setPopover(null)}
                onSave={() =>
                  runBackground(() =>
                    leadLifecycleAction(lead.id, "reschedule_call", {
                      scheduledFor: fromDatetimeLocalIST(rescheduleAt),
                      note: note || null
                    })
                  )
                }
                saveLabel="Reschedule"
              />
            }
          >
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Reschedule call</h3>
              <input
                type="datetime-local"
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={rescheduleAt}
                onChange={(e) => setRescheduleAt(e.target.value)}
              />
            </div>
          </ActionPopover>
        ) : null}
        {showHistoryToggle ? (
          <button type="button" className={ghostBtn} onClick={onToggleHistory}>
            {historyOpen ? "Hide history" : "View history"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
