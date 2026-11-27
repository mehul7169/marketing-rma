"use client";

import { useState } from "react";
import ActionPopover from "@/components/leads/ActionPopover";
import type { LeadReminder } from "@/lib/leads/types";
import { formatDueFriendly } from "@/lib/timezone";

export default function DueFollowUpBadge({ reminders }: { reminders: LeadReminder[] }) {
  const [open, setOpen] = useState(false);
  if (reminders.length === 0) return null;

  return (
    <span
      className="ml-2 inline-block align-middle"
      onClick={(e) => e.stopPropagation()}
    >
      <ActionPopover
        open={open}
        onOpenChange={setOpen}
        placement="bottom-start"
        widthClass="w-56"
        bodyClassName="px-3 py-2"
        trigger={
          <button
            type="button"
            className="rounded-full border border-danger-soft bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger"
            title={reminders.map((r) => r.text).join(" · ")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            Due
            {reminders.length > 1 ? ` ${reminders.length}` : ""}
          </button>
        }
      >
        <span data-testid="due-follow-up-popover" className="block text-left text-xs text-fg">
          {reminders.map((r) => (
            <span key={r.id} className="mb-1.5 block last:mb-0">
              <span className="block text-fg">{r.text}</span>
              <span className="text-muted">{formatDueFriendly(r.due_at)}</span>
            </span>
          ))}
        </span>
      </ActionPopover>
      <span className="sr-only">
        {reminders.length === 1 ? "Follow-up" : `${reminders.length} follow-ups`}
      </span>
    </span>
  );
}
