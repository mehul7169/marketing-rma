"use client";

import { useRef, useState } from "react";
import ActionPopover from "@/components/leads/ActionPopover";
import { lifecycleBlockReason } from "@/lib/leads/gridGuards";
import type {
  LifecycleAction,
  LifecyclePayload,
  LogCallOutcome
} from "@/lib/leads/lifecycle";
import { LOG_CALL_OUTCOMES } from "@/lib/leads/lifecycle";
import type { LeadRow } from "@/lib/leads/types";
import {
  fromDatetimeLocalIST,
  toDatetimeLocalIST,
  tomorrowSameTimeLocalIST
} from "@/lib/timezone";

export type StageMenuConfirm = {
  action: LifecycleAction;
  payload: LifecyclePayload;
  title: string;
  message: string;
  reasonRequired?: boolean;
  showDeadReason?: boolean;
  confirmLabel?: string;
  anchor?: HTMLElement | null;
};

const OUTCOME_LABEL: Record<LogCallOutcome, string> = {
  no_answer: "No answer",
  follow_up_needed: "Follow-up needed",
  qualified: "Qualified",
  not_qualified: "Not qualified"
};

type Panel = "menu" | "log_call" | "book_call" | null;

export default function StageActionMenu({
  lead,
  disabled = false,
  onRun,
  onConfirm
}: {
  lead: LeadRow;
  disabled?: boolean;
  onRun: (action: LifecycleAction, payload?: LifecyclePayload) => void;
  onConfirm: (spec: StageMenuConfirm) => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [outcome, setOutcome] = useState<LogCallOutcome>("no_answer");
  const [followUpAt, setFollowUpAt] = useState(tomorrowSameTimeLocalIST());
  const [callAt, setCallAt] = useState(
    toDatetimeLocalIST(lead.call_scheduled_for) || tomorrowSameTimeLocalIST()
  );
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (disabled) return null;

  const bookAction: LifecycleAction = lead.call_booked_at
    ? "reschedule_call"
    : "book_call";
  const items: Array<{
    id: string;
    label: string;
    action?: LifecycleAction;
    disabledReason?: string | null;
    onPick: () => void;
  }> = [
    {
      id: "log_call",
      label: "Log call",
      action: "log_call_attempt",
      disabledReason: lifecycleBlockReason(lead, "log_call_attempt"),
      onPick: () => {
        setOutcome("no_answer");
        setError(null);
        setPanel("log_call");
      }
    },
    {
      id: "book_call",
      label: lead.call_booked_at ? "Reschedule call" : "Book call",
      action: bookAction,
      disabledReason: lifecycleBlockReason(lead, bookAction),
      onPick: () => {
        setCallAt(
          toDatetimeLocalIST(lead.call_scheduled_for) ||
            tomorrowSameTimeLocalIST()
        );
        setError(null);
        setPanel("book_call");
      }
    },
    {
      id: "mark_showed",
      label: "Mark showed",
      action: "mark_showed",
      disabledReason: lifecycleBlockReason(lead, "mark_showed"),
      onPick: () => {
        setPanel(null);
        onRun("mark_showed");
      }
    },
    {
      id: "mark_no_show",
      label: "Mark no-show",
      action: "mark_no_show",
      disabledReason: lifecycleBlockReason(lead, "mark_no_show"),
      onPick: () => {
        setPanel(null);
        onConfirm({
          action: "mark_no_show",
          payload: {},
          title: "Mark no-show",
          message: "Marking no-show also moves this lead to Dead.",
          confirmLabel: "Mark no-show",
          anchor: triggerRef.current
        });
      }
    },
    {
      id: "mark_dead",
      label: "Mark dead",
      action: "mark_dead",
      disabledReason: lifecycleBlockReason(lead, "mark_dead"),
      onPick: () => {
        setPanel(null);
        onConfirm({
          action: "mark_dead",
          payload: {},
          title: "Mark dead",
          message:
            lead.call_showed === true
              ? "This lead showed up for a call. Mark it dead anyway?"
              : lead.call_booked_at
                ? "This lead has a booked call. Mark it dead anyway?"
                : "Mark this lead dead?",
          showDeadReason: true,
          confirmLabel: "Mark dead",
          anchor: triggerRef.current
        });
      }
    },
    {
      id: "revive",
      label: "Revive",
      action: "revive",
      disabledReason: lifecycleBlockReason(lead, "revive"),
      onPick: () => {
        setPanel(null);
        onRun("revive");
      }
    }
  ];

  function submitLogCall() {
    if (outcome === "follow_up_needed" && !followUpAt.trim()) {
      setError("Follow-up time is required");
      return;
    }
    const alreadyScheduled = Boolean(lead.call_scheduled_for);
    if (outcome === "qualified" && !alreadyScheduled && !callAt.trim()) {
      setError("Call date/time is required when marking Qualified");
      return;
    }
    setPanel(null);
    onRun("log_call_attempt", {
      outcome,
      followUpAt:
        outcome === "follow_up_needed" ? fromDatetimeLocalIST(followUpAt) : null,
      scheduledFor:
        outcome === "qualified" && !alreadyScheduled
          ? fromDatetimeLocalIST(callAt)
          : null
    });
  }

  function submitBook() {
    if (!callAt.trim()) {
      setError("Pick a date and time for the call.");
      return;
    }
    setPanel(null);
    onRun(bookAction, { scheduledFor: fromDatetimeLocalIST(callAt) });
  }

  const formFooter = (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        className="text-xs text-slate-600"
        onClick={() => setPanel(null)}
      >
        Cancel
      </button>
      <button
        type="button"
        className="btn-brand text-xs"
        onClick={panel === "book_call" ? submitBook : submitLogCall}
      >
        Save
      </button>
    </div>
  );

  return (
    <div data-no-row-nav>
      <ActionPopover
        open={panel !== null}
        onOpenChange={(next) => {
          if (!next) setPanel(null);
        }}
        role={panel === "menu" ? "menu" : "dialog"}
        widthClass={panel === "menu" ? "w-48" : "w-72"}
        bodyClassName={panel === "menu" ? "py-1" : "p-3"}
        footer={
          panel === "log_call" || panel === "book_call" ? formFooter : undefined
        }
        trigger={
          <button
            ref={triggerRef}
            type="button"
            className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
            aria-haspopup="menu"
            aria-expanded={panel !== null}
            onClick={(e) => {
              e.stopPropagation();
              setPanel(panel ? null : "menu");
            }}
          >
            Actions
          </button>
        }
      >
        {panel === "menu" ? (
          <>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={Boolean(item.disabledReason)}
                title={item.disabledReason ?? undefined}
                data-testid={`stage-action-${item.id}`}
                className="block w-full px-3 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                onClick={() => {
                  if (item.disabledReason) return;
                  item.onPick();
                }}
              >
                {item.label}
              </button>
            ))}
          </>
        ) : null}
        {panel === "log_call" ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-800">Log call</div>
            <label className="block text-xs text-slate-600">
              Outcome
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as LogCallOutcome)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              >
                {LOG_CALL_OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABEL[o]}
                  </option>
                ))}
              </select>
            </label>
            {outcome === "follow_up_needed" ? (
              <label className="block text-xs text-slate-600">
                Follow-up (IST)
                <input
                  type="datetime-local"
                  value={followUpAt}
                  onChange={(e) => setFollowUpAt(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                />
              </label>
            ) : null}
            {outcome === "qualified" && !lead.call_scheduled_for ? (
              <label className="block text-xs text-slate-600">
                Call scheduled for (IST)
                <input
                  type="datetime-local"
                  value={callAt}
                  onChange={(e) => setCallAt(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                />
              </label>
            ) : null}
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        ) : null}
        {panel === "book_call" ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-800">
              {lead.call_booked_at ? "Reschedule call" : "Book call"}
            </div>
            <label className="block text-xs text-slate-600">
              Date & time (IST)
              <input
                type="datetime-local"
                value={callAt}
                onChange={(e) => setCallAt(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        ) : null}
      </ActionPopover>
    </div>
  );
}
