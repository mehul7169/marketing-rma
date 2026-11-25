"use client";

import { useState } from "react";
import ActionPopover from "@/components/leads/ActionPopover";
import LogFollowUpForm from "@/components/deals/LogFollowUpForm";
import {
  DEAL_STAGE_LABELS,
  DEAL_STAGES,
  LOST_REASON_LABELS,
  LOST_REASONS,
  type DealAction,
  type DealPayload,
  type DealStage
} from "@/lib/deals/dealLifecycle";
import {
  emptyFollowUpForm,
  followUpWhenQuickPicks,
  validateFollowUpForm
} from "@/lib/deals/followUpForm";
import { DEAL_ERRORS } from "@/lib/deals/dealLifecycle";
import type { LeadRow } from "@/lib/leads/types";
import { actorDisplayName } from "@/lib/deals/dealGroups";

export type DealMember = { userId: string; email: string };

type MenuMode =
  | "follow_up"
  | "more"
  | "stage"
  | "owner"
  | "won"
  | "lost"
  | "reopen"
  | null;

export default function DealQuickActions({
  lead,
  members,
  preview,
  onSave,
  openFollowUp = false,
  onFollowUpOpenChange
}: {
  lead: LeadRow;
  members: DealMember[];
  preview: boolean;
  onSave: (action: DealAction, payload: DealPayload) => Promise<boolean>;
  openFollowUp?: boolean;
  onFollowUpOpenChange?: (open: boolean) => void;
}) {
  const [menu, setMenu] = useState<MenuMode>(null);
  const followUpOpen = openFollowUp || menu === "follow_up";
  const moreOpen = menu === "more" || menu === "stage" || menu === "owner" || menu === "won" || menu === "lost" || menu === "reopen";

  if (preview) return null;

  function setFollowUp(open: boolean) {
    if (onFollowUpOpenChange) onFollowUpOpenChange(open);
    else setMenu(open ? "follow_up" : null);
  }

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {lead.deal_closed === null ? (
        <ActionPopover
          open={followUpOpen}
          onOpenChange={setFollowUp}
          placement="bottom-end"
          widthClass="w-[22rem]"
          trigger={
            <button
              type="button"
              data-testid="deal-log-follow-up"
              className="whitespace-nowrap rounded px-2 py-1 text-xs font-medium text-fg hover:bg-surface-2"
              onClick={() => setFollowUp(true)}
            >
              Log follow-up
            </button>
          }
        >
          <LogFollowUpForm
            lead={lead}
            onCancel={() => setFollowUp(false)}
            onSubmit={async (action, payload) => {
              const ok = await onSave(action, payload);
              if (ok) setFollowUp(false);
              return ok;
            }}
          />
        </ActionPopover>
      ) : lead.deal_closed === false ? (
        <ActionPopover
          open={menu === "reopen"}
          onOpenChange={(open) => setMenu(open ? "reopen" : null)}
          placement="bottom-end"
          widthClass="w-80"
          trigger={
            <button
              type="button"
              data-testid="deal-reopen"
              className="rounded px-2 py-1 text-xs font-medium text-fg hover:bg-surface-2"
              onClick={() => setMenu("reopen")}
            >
              Reopen
            </button>
          }
        >
          <ReopenForm
            onCancel={() => setMenu(null)}
            onSubmit={async (payload) => {
              const ok = await onSave("reopen", payload);
              if (ok) setMenu(null);
              return ok;
            }}
          />
        </ActionPopover>
      ) : null}

      {lead.deal_closed === null ? (
        <ActionPopover
          open={moreOpen}
          onOpenChange={(open) => setMenu(open ? "more" : null)}
          placement="bottom-end"
          widthClass="w-72"
          trigger={
            <button
              type="button"
              data-testid="deal-more"
              aria-label="More deal actions"
              className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg"
              onClick={() => setMenu("more")}
            >
              ⋯
            </button>
          }
        >
          {menu === "more" || menu === null ? (
            <div className="flex flex-col py-1 text-sm">
              <MoreItem testId="deal-change-stage" onClick={() => setMenu("stage")}>
                Change stage
              </MoreItem>
              <MoreItem testId="deal-assign-owner" onClick={() => setMenu("owner")}>
                Assign owner
              </MoreItem>
              <MoreItem testId="deal-mark-won" onClick={() => setMenu("won")}>
                Mark won
              </MoreItem>
              <MoreItem testId="deal-mark-lost" onClick={() => setMenu("lost")}>
                Mark lost
              </MoreItem>
            </div>
          ) : null}
          {menu === "stage" ? (
            <StageForm
              current={lead.post_call_status}
              onBack={() => setMenu("more")}
              onPick={async (stage) => {
                const ok = await onSave("change_stage", { stage });
                if (ok) setMenu(null);
              }}
            />
          ) : null}
          {menu === "owner" ? (
            <OwnerForm
              current={lead.owner_id}
              members={members}
              onBack={() => setMenu("more")}
              onPick={async (ownerId) => {
                const ok = await onSave("assign_owner", { ownerId });
                if (ok) setMenu(null);
              }}
            />
          ) : null}
          {menu === "won" || menu === "lost" ? (
            <LogFollowUpForm
              lead={lead}
              initialMode={menu}
              onCancel={() => setMenu("more")}
              onSubmit={async (action, payload) => {
                const ok = await onSave(action, payload);
                if (ok) setMenu(null);
                return ok;
              }}
            />
          ) : null}
        </ActionPopover>
      ) : null}
    </div>
  );
}

function MoreItem({
  children,
  onClick,
  testId
}: {
  children: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      className="px-3 py-1.5 text-left text-fg hover:bg-surface-2"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StageForm({
  current,
  onBack,
  onPick
}: {
  current: string | null;
  onBack: () => void;
  onPick: (stage: DealStage | null) => void;
}) {
  return (
    <div className="space-y-1 p-1">
      <button type="button" className="text-xs text-muted" onClick={onBack}>
        ← Back
      </button>
      <button
        type="button"
        className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
          !current ? "bg-surface-2 font-medium" : "hover:bg-surface-2"
        }`}
        onClick={() => onPick(null)}
      >
        Showed up
      </button>
      {DEAL_STAGES.map((s) => (
        <button
          key={s}
          type="button"
          className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
            current === s ? "bg-surface-2 font-medium" : "hover:bg-surface-2"
          }`}
          onClick={() => onPick(s)}
        >
          {DEAL_STAGE_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

function OwnerForm({
  current,
  members,
  onBack,
  onPick
}: {
  current: string | null;
  members: DealMember[];
  onBack: () => void;
  onPick: (ownerId: string | null) => void;
}) {
  return (
    <div className="space-y-1 p-1">
      <button type="button" className="text-xs text-muted" onClick={onBack}>
        ← Back
      </button>
      <button
        type="button"
        className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
          !current ? "bg-surface-2 font-medium" : "hover:bg-surface-2"
        }`}
        onClick={() => onPick(null)}
      >
        Unassigned
      </button>
      {members.map((m) => (
        <button
          key={m.userId}
          type="button"
          className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
            current === m.userId ? "bg-surface-2 font-medium" : "hover:bg-surface-2"
          }`}
          onClick={() => onPick(m.userId)}
        >
          {actorDisplayName(m.email)}
        </button>
      ))}
    </div>
  );
}

function ReopenForm({
  onSubmit,
  onCancel
}: {
  onSubmit: (payload: DealPayload) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [whenLocal, setWhenLocal] = useState(
    () => followUpWhenQuickPicks()[0]?.local ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const check = validateFollowUpForm({
      ...emptyFollowUpForm(),
      mode: "follow_up",
      outcome: "spoke",
      nextStep,
      whenLocal,
      confirmPast: true,
      note
    });
    if (!note.trim()) {
      setError(DEAL_ERRORS.reopenReasonRequired);
      return;
    }
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setSaving(true);
    try {
      const ok = await onSubmit({
        note: note.trim(),
        next_step: check.payload.next_step,
        next_action_at: check.payload.next_action_at,
        confirmPast: true
      });
      if (!ok) return;
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      data-testid="reopen-form"
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Reason</span>
        <textarea
          data-testid="reopen-reason"
          rows={2}
          className="w-full rounded border border-subtle px-2 py-1.5 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Next step</span>
        <input
          data-testid="reopen-next-step"
          className="w-full rounded border border-subtle px-2 py-1.5 text-sm"
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">When (IST)</span>
        <input
          data-testid="reopen-when"
          type="datetime-local"
          className="w-full rounded border border-subtle px-2 py-1.5 text-sm"
          value={whenLocal}
          onChange={(e) => setWhenLocal(e.target.value)}
        />
      </label>
      {error ? (
        <p className="text-xs text-danger" data-testid="reopen-error">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="text-sm text-muted" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          data-testid="reopen-save"
          disabled={saving}
          className="rounded-control bg-accent px-3 py-1.5 text-sm text-accent-fg disabled:opacity-60"
        >
          {saving ? "Saving…" : "Reopen"}
        </button>
      </div>
    </form>
  );
}
