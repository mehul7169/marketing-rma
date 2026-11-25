"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEAL_ERRORS,
  DEAL_STAGE_LABELS,
  DEAL_STAGES,
  LOST_REASON_LABELS,
  LOST_REASONS,
  dealStageLabel,
  type DealAction,
  type DealPayload
} from "@/lib/deals/dealLifecycle";
import {
  DEAL_FOLLOW_UP_OUTCOMES,
  FOLLOW_UP_OUTCOME_LABELS,
  NEXT_STEP_PILLS,
  emptyFollowUpForm,
  followUpWhenQuickPicks,
  validateFollowUpForm,
  type FollowUpFormState
} from "@/lib/deals/followUpForm";
import { fromDatetimeLocalIST } from "@/lib/timezone";
import type { LeadRow } from "@/lib/leads/types";

const pillIdle =
  "rounded-full border border-subtle px-2.5 py-1 text-xs text-fg hover:bg-surface-2";
const pillOn =
  "rounded-pill border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg";

export default function LogFollowUpForm({
  lead,
  onSubmit,
  onCancel,
  embedded = false,
  initialMode = "follow_up"
}: {
  lead: LeadRow;
  onSubmit: (
    action: DealAction,
    payload: DealPayload
  ) => Promise<boolean> | boolean;
  onCancel?: () => void;
  embedded?: boolean;
  initialMode?: FollowUpFormState["mode"];
}) {
  const [state, setState] = useState<FollowUpFormState>(() => ({
    ...emptyFollowUpForm(),
    mode: initialMode
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nextCustom, setNextCustom] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const picks = useMemo(() => followUpWhenQuickPicks(), []);

  useEffect(() => {
    if (state.outcome) noteRef.current?.focus();
  }, [state.outcome]);

  const stageLabel = dealStageLabel(lead.post_call_status);
  const whenPast = isPastLocal(state.whenLocal);

  function patch(p: Partial<FollowUpFormState>) {
    setState((s) => ({ ...s, ...p }));
    setError(null);
  }

  async function save() {
    const next = whenPast ? { ...state, confirmPast: state.confirmPast } : state;
    const result = validateFollowUpForm(next);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaving(true);
    try {
      const ok = await onSubmit(result.action, result.payload);
      if (!ok) return;
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void save();
    }
  }

  const saveLabel =
    state.mode === "won" ? "Mark won" : state.mode === "lost" ? "Mark lost" : "Save";

  return (
    <form
      data-testid="log-follow-up-form"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      onKeyDown={onKeyDown}
    >
      {state.mode === "follow_up" ? (
        <>
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">
              What happened
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {DEAL_FOLLOW_UP_OUTCOMES.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-testid={`follow-up-outcome-${id}`}
                  className={state.outcome === id ? pillOn : pillIdle}
                  onClick={() => patch({ outcome: id })}
                >
                  {FOLLOW_UP_OUTCOME_LABELS[id]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Note</span>
            <textarea
              ref={noteRef}
              data-testid="follow-up-note"
              rows={2}
              value={state.note}
              onChange={(e) => patch({ note: e.target.value })}
              className="w-full rounded border border-subtle px-2 py-1.5 text-sm"
              placeholder="Optional"
            />
          </label>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">
              Next step
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {NEXT_STEP_PILLS.map((label) => (
                <button
                  key={label}
                  type="button"
                  data-testid={`follow-up-next-${label}`}
                  className={
                    !nextCustom && state.nextStep === label ? pillOn : pillIdle
                  }
                  onClick={() => {
                    setNextCustom(false);
                    patch({ nextStep: label });
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className={nextCustom ? pillOn : pillIdle}
                onClick={() => setNextCustom(true)}
              >
                Other
              </button>
            </div>
            {nextCustom ? (
              <input
                data-testid="follow-up-next-custom"
                className="mt-1.5 w-full rounded border border-subtle px-2 py-1.5 text-sm"
                value={state.nextStep}
                onChange={(e) => patch({ nextStep: e.target.value })}
                placeholder="What to do next"
              />
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">When</legend>
            <div className="flex flex-wrap gap-1.5">
              {picks.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`follow-up-when-${p.id}`}
                  className={state.whenLocal === p.local ? pillOn : pillIdle}
                  onClick={() => patch({ whenLocal: p.local, confirmPast: false })}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              data-testid="follow-up-when"
              type="datetime-local"
              className="mt-1.5 w-full rounded border border-subtle px-2 py-1.5 text-sm"
              value={state.whenLocal}
              onChange={(e) =>
                patch({ whenLocal: e.target.value, confirmPast: false })
              }
            />
            {whenPast ? (
              <label className="mt-1.5 flex items-center gap-2 text-xs text-warning">
                <input
                  type="checkbox"
                  data-testid="follow-up-confirm-past"
                  checked={state.confirmPast}
                  onChange={(e) => patch({ confirmPast: e.target.checked })}
                />
                This time is in the past. Confirm to save.
              </label>
            ) : null}
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Stage
            </span>
            <select
              data-testid="follow-up-stage"
              className="w-full rounded border border-subtle px-2 py-1.5 text-sm"
              value={state.stage}
              onChange={(e) =>
                patch({ stage: e.target.value as FollowUpFormState["stage"] })
              }
            >
              <option value="keep">Keep: {stageLabel}</option>
              <option value="">Showed up</option>
              {DEAL_STAGES.map((s) => (
                <option key={s} value={s}>
                  {DEAL_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      {state.mode === "won" ? (
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Value
            </span>
            <input
              data-testid="follow-up-value"
              type="number"
              min={0}
              className="w-full rounded border border-subtle px-2 py-1.5 text-sm"
              value={state.value}
              onChange={(e) => patch({ value: e.target.value })}
              placeholder="Optional"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Closed (IST)
            </span>
            <input
              data-testid="follow-up-closed"
              type="datetime-local"
              className="w-full rounded border border-subtle px-2 py-1.5 text-sm"
              value={state.closedLocal}
              onChange={(e) => patch({ closedLocal: e.target.value })}
            />
          </label>
        </div>
      ) : null}

      {state.mode === "lost" ? (
        <div className="space-y-2">
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">
              Lost reason
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {LOST_REASONS.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-testid={`follow-up-lost-${id}`}
                  className={state.lostReason === id ? pillOn : pillIdle}
                  onClick={() => patch({ lostReason: id })}
                >
                  {LOST_REASON_LABELS[id]}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Note
            </span>
            <textarea
              rows={2}
              data-testid="follow-up-lost-note"
              value={state.note}
              onChange={(e) => patch({ note: e.target.value })}
              className="w-full rounded border border-subtle px-2 py-1.5 text-sm"
              placeholder="Optional"
            />
          </label>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-danger" data-testid="follow-up-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          data-testid="follow-up-save"
          disabled={saving}
          className="rounded-control bg-accent px-3 py-1.5 text-sm text-accent-fg disabled:opacity-60"
        >
          {saving ? "Saving…" : saveLabel}
        </button>
        {state.mode === "follow_up" ? (
          <>
            <button
              type="button"
              data-testid="follow-up-mark-won"
              className="text-sm text-muted hover:text-fg"
              onClick={() => patch({ mode: "won" })}
            >
              Mark won
            </button>
            <button
              type="button"
              data-testid="follow-up-mark-lost"
              className="text-sm text-muted hover:text-fg"
              onClick={() => patch({ mode: "lost" })}
            >
              Mark lost
            </button>
          </>
        ) : (
          <button
            type="button"
            className="text-sm text-muted hover:text-fg"
            onClick={() => patch({ mode: "follow_up" })}
          >
            Back
          </button>
        )}
        {onCancel && !embedded ? (
          <button
            type="button"
            className="ml-auto text-sm text-muted hover:text-fg"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function isPastLocal(local: string): boolean {
  if (!local.trim()) return false;
  try {
    return Date.parse(fromDatetimeLocalIST(local)) < Date.now();
  } catch {
    return false;
  }
}
