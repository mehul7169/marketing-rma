"use client";

import { useState } from "react";
import ActionPopover from "@/components/leads/ActionPopover";
import {
  DEAD_REASON_CODES,
  deadReasonLabel,
  type DeadReasonCode
} from "@/lib/leads/types";

export default function ConfirmPopover({
  title,
  message,
  confirmLabel = "Confirm",
  reasonRequired = false,
  reasonLabel = "Reason",
  showDeadReason = false,
  anchor = null,
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  reasonRequired?: boolean;
  reasonLabel?: string;
  showDeadReason?: boolean;
  anchor?: HTMLElement | null;
  onConfirm: (opts: {
    reason?: string;
    deadReason?: DeadReasonCode | null;
  }) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [deadReason, setDeadReason] = useState<DeadReasonCode | "">("");
  const blocked = reasonRequired && !reason.trim();

  return (
    <ActionPopover
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      reference={anchor}
      labelledBy="confirm-title"
      widthClass="w-80 max-w-[calc(100vw-16px)]"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={blocked}
            className="btn-brand disabled:opacity-60"
            onClick={() =>
              onConfirm({
                reason: reason.trim() || undefined,
                deadReason: deadReason || null
              })
            }
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <h2 id="confirm-title" className="text-sm font-medium text-slate-900">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
      {showDeadReason ? (
        <label className="mt-3 block text-xs text-slate-600">
          Dead reason (optional)
          <select
            value={deadReason}
            onChange={(e) =>
              setDeadReason(e.target.value as DeadReasonCode | "")
            }
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            <option value="">No reason</option>
            {DEAD_REASON_CODES.map((code) => (
              <option key={code} value={code}>
                {deadReasonLabel(code)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {reasonRequired ? (
        <label className="mt-3 block text-xs text-slate-600">
          {reasonLabel}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
      ) : null}
    </ActionPopover>
  );
}
