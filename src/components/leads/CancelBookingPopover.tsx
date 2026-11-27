"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { leadLifecycleAction } from "@/app/leads/actions";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import { useActorEmail } from "@/components/leads/ActorEmailContext";
import ActionPopover from "@/components/leads/ActionPopover";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import {
  CANCEL_BOOKING_UNDO_MS,
  canCancelBooking,
  defaultCancelReason,
  isWorkQueueQualifyAndBook
} from "@/lib/leads/cancelBooking";
import { leadErrorToast } from "@/lib/leads/leadErrorToast";
import {
  planLifecycle,
  type LifecyclePayload
} from "@/lib/leads/lifecycle";
import {
  CANCEL_BOOKING_LABELS,
  CANCEL_BOOKING_REASONS,
  type CancelBookingReason,
  type LeadRow
} from "@/lib/leads/types";
import {
  fromDatetimeLocalIST,
  tomorrowSameTimeLocalIST
} from "@/lib/timezone";

const REAL_CANCEL: CancelBookingReason[] = [
  "not_qualified",
  "unreachable",
  "duplicate_booking",
  "lead_cancelled",
  "other"
];

export function cancelHint(reason: CancelBookingReason | null): string {
  if (reason === "logged_by_mistake") {
    return "Reverts the booking as if it never happened";
  }
  return "Removes it from Calls Booked and show-rate numbers";
}

export function CancelBookingFields({
  lead,
  actorEmail,
  reason,
  onReason,
  note,
  onNote,
  followUpAt,
  onFollowUpAt,
  undoQualification,
  onUndoQualification,
  error
}: {
  lead: LeadRow;
  actorEmail: string | null;
  reason: CancelBookingReason | null;
  onReason: (r: CancelBookingReason) => void;
  note: string;
  onNote: (v: string) => void;
  followUpAt: string;
  onFollowUpAt: (v: string) => void;
  undoQualification: boolean;
  onUndoQualification: (v: boolean) => void;
  error?: string | null;
}) {
  const showUndoQual =
    reason === "logged_by_mistake" && isWorkQueueQualifyAndBook(lead);
  void actorEmail;
  return (
    <div className="space-y-3" data-testid="cancel-booking-form">
      <div className="text-sm font-medium text-fg">Cancel booking</div>
      <div className="flex flex-wrap gap-1.5">
        {CANCEL_BOOKING_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={reason === r}
            data-testid={`cancel-reason-${r}`}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              reason === r
                ? "border-accent bg-accent-soft text-fg"
                : "border-subtle text-muted hover:bg-surface-2 hover:text-fg"
            }`}
            onClick={() => onReason(r)}
          >
            {CANCEL_BOOKING_LABELS[r]}
          </button>
        ))}
      </div>
      {reason === "unreachable" ? (
        <label className="block text-xs text-muted">
          Follow-up (IST)
          <input
            type="datetime-local"
            data-testid="cancel-follow-up"
            className="mt-1 w-full rounded border border-subtle px-2 py-1.5 text-sm text-fg"
            value={followUpAt}
            onChange={(e) => onFollowUpAt(e.target.value)}
          />
        </label>
      ) : null}
      {showUndoQual ? (
        <label className="flex items-center gap-2 text-xs text-fg">
          <input
            type="checkbox"
            data-testid="cancel-undo-qualification"
            checked={undoQualification}
            onChange={(e) => onUndoQualification(e.target.checked)}
          />
          Also undo the qualification
        </label>
      ) : null}
      <label className="block text-xs text-muted">
        Note{reason === "other" ? " (required)" : " (optional)"}
        <textarea
          data-testid="cancel-note"
          className="mt-1 w-full rounded border border-subtle px-2 py-1.5 text-sm text-fg"
          rows={2}
          value={note}
          onChange={(e) => onNote(e.target.value)}
        />
      </label>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function buildCancelPayload(opts: {
  reason: CancelBookingReason | null;
  note: string;
  followUpAt: string;
  undoQualification: boolean;
}): { ok: true; payload: LifecyclePayload } | { ok: false; error: string } {
  if (!opts.reason) return { ok: false, error: "Pick a cancel reason." };
  if (opts.reason === "other" && !opts.note.trim()) {
    return { ok: false, error: "Add a note for Other." };
  }
  if (opts.reason === "unreachable" && !opts.followUpAt.trim()) {
    return { ok: false, error: "Pick a follow-up date." };
  }
  return {
    ok: true,
    payload: {
      reason: opts.reason,
      note: opts.note.trim() || null,
      followUpAt:
        opts.reason === "unreachable"
          ? fromDatetimeLocalIST(opts.followUpAt)
          : null,
      undoQualification: opts.undoQualification
    }
  };
}

export function toastCancelledBooking(
  lead: LeadRow,
  cancelled: LeadRow,
  onUndo: (restored: LeadRow) => void
) {
  toastSuccess("Booking cancelled", {
    durationMs: CANCEL_BOOKING_UNDO_MS,
    action: {
      label: "Undo",
      onClick: () => {
        void leadLifecycleAction(cancelled.id, "undo_cancel_booking", {}).then(
          (res) => {
            if (!res.ok) {
              toastError(leadErrorToast(lead, res.error));
              return;
            }
            onUndo(res.lead);
          }
        );
      }
    }
  });
}

export default function CancelBookingPopover({
  lead,
  trigger,
  onRun,
  onLeadPatched,
  onLeadRollback
}: {
  lead: LeadRow;
  trigger: ReactElement;
  onRun?: (payload: LifecyclePayload) => void;
  onLeadPatched?: (patch: Partial<LeadRow> | LeadRow) => void;
  onLeadRollback?: (snapshot: LeadRow) => void;
}) {
  const preview = useOrgPreview();
  const actorEmail = useActorEmail();
  const [open, setOpen] = useState(false);
  const initialReason = useMemo(
    () => defaultCancelReason(lead, actorEmail),
    [lead, actorEmail]
  );
  const [reason, setReason] = useState<CancelBookingReason | null>(initialReason);
  const [note, setNote] = useState("");
  const [followUpAt, setFollowUpAt] = useState(tomorrowSameTimeLocalIST());
  const [undoQualification, setUndoQualification] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason(defaultCancelReason(lead, actorEmail));
      setNote("");
      setFollowUpAt(tomorrowSameTimeLocalIST());
      setUndoQualification(false);
      setError(null);
    }
  }, [open, lead, actorEmail]);

  if (preview.active || !canCancelBooking(lead)) return null;

  function submit() {
    const built = buildCancelPayload({
      reason,
      note,
      followUpAt,
      undoQualification
    });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setOpen(false);
    if (onRun) {
      onRun(built.payload);
      return;
    }
    const snapshot = lead;
    const plan = planLifecycle(lead, "cancel_booking", built.payload, {
      userId: null,
      email: actorEmail
    });
    if (plan.ok) onLeadPatched?.(plan.patch);
    void leadLifecycleAction(lead.id, "cancel_booking", built.payload).then(
      (res) => {
        if (!res.ok) {
          onLeadRollback?.(snapshot);
          toastError(leadErrorToast(lead, res.error));
          return;
        }
        onLeadPatched?.(res.lead);
        toastCancelledBooking(lead, res.lead, (restored) =>
          onLeadPatched?.(restored)
        );
      }
    );
  }

  return (
    <ActionPopover
      open={open}
      onOpenChange={setOpen}
      widthClass="w-80 max-w-[calc(100vw-16px)]"
      trigger={trigger}
      footer={
        <div className="space-y-2">
          <p className="text-[11px] text-muted">{cancelHint(reason)}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded border border-subtle px-2.5 py-1 text-sm"
              onClick={() => setOpen(false)}
            >
              Back
            </button>
            <button
              type="button"
              data-testid="cancel-booking-confirm"
              className="btn-brand text-sm"
              onClick={submit}
            >
              Cancel booking
            </button>
          </div>
        </div>
      }
    >
      <CancelBookingFields
        lead={lead}
        actorEmail={actorEmail}
        reason={reason}
        onReason={setReason}
        note={note}
        onNote={setNote}
        followUpAt={followUpAt}
        onFollowUpAt={setFollowUpAt}
        undoQualification={undoQualification}
        onUndoQualification={setUndoQualification}
        error={error}
      />
    </ActionPopover>
  );
}

export function CancelBookingButton({
  lead,
  onRun,
  onLeadPatched,
  onLeadRollback
}: {
  lead: LeadRow;
  onRun?: (payload: LifecyclePayload) => void;
  onLeadPatched?: (patch: Partial<LeadRow> | LeadRow) => void;
  onLeadRollback?: (snapshot: LeadRow) => void;
}) {
  const preview = useOrgPreview();
  if (preview.active || !canCancelBooking(lead)) return null;
  return (
    <CancelBookingPopover
      lead={lead}
      onRun={onRun}
      onLeadPatched={onLeadPatched}
      onLeadRollback={onLeadRollback}
      trigger={
        <button
          type="button"
          data-testid="cancel-booking-button"
          title="Cancel booking"
          aria-label="Cancel booking"
          className="rounded px-1 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-fg"
        >
          ✕
        </button>
      }
    />
  );
}

export { REAL_CANCEL };
