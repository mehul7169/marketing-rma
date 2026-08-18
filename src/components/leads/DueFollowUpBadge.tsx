"use client";

import { useState } from "react";
import type { LeadReminder } from "@/lib/leads/types";
import { formatDueFriendly } from "@/lib/timezone";

export default function DueFollowUpBadge({ reminders }: { reminders: LeadReminder[] }) {
  const [open, setOpen] = useState(false);
  if (reminders.length === 0) return null;

  return (
    <span className="relative ml-2 inline-block align-middle">
      <button
        type="button"
        className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-800"
        title={reminders.map((r) => r.text).join(" · ")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      >
        Due
        {reminders.length > 1 ? ` ${reminders.length}` : ""}
      </button>
      {open ? (
        <span
          className="absolute left-0 z-20 mt-1 w-56 rounded border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {reminders.map((r) => (
            <span key={r.id} className="mb-1.5 block last:mb-0">
              <span className="block text-slate-900">{r.text}</span>
              <span className="text-slate-500">{formatDueFriendly(r.due_at)}</span>
            </span>
          ))}
        </span>
      ) : null}
      <span className="sr-only">
        {reminders.length === 1 ? "Follow-up due" : `${reminders.length} follow-ups due`}
      </span>
    </span>
  );
}
