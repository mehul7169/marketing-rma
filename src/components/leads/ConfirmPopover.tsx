"use client";

import { useEffect, useState } from "react";
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
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  reasonRequired?: boolean;
  reasonLabel?: string;
  showDeadReason?: boolean;
  onConfirm: (opts: {
    reason?: string;
    deadReason?: DeadReasonCode | null;
  }) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [deadReason, setDeadReason] = useState<DeadReasonCode | "">("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const blocked = reasonRequired && !reason.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded border border-slate-200 bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
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
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
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
      </div>
    </div>
  );
}
