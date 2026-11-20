"use client";

import DealOwnerAvatar from "@/components/deals/DealOwnerAvatar";
import DealQuickActions, { type DealMember } from "@/components/deals/DealQuickActions";
import DealStagePill from "@/components/deals/DealStagePill";
import {
  formatDealDueAt,
  formatLastTouch,
  formatShowedDate,
  needsNextStep
} from "@/lib/deals/dealGroups";
import type { DealAction, DealPayload } from "@/lib/deals/dealLifecycle";
import { formatCurrencyNullable } from "@/lib/format";
import type { LeadRow } from "@/lib/leads/types";

export default function DealRow({
  lead,
  lastTouch,
  ownerEmail,
  members,
  preview,
  overdue,
  onOpen,
  onSave
}: {
  lead: LeadRow;
  lastTouch: { note: string | null; actorEmail: string | null };
  ownerEmail: string | null;
  members: DealMember[];
  preview: boolean;
  overdue: boolean;
  onOpen: () => void;
  onSave: (action: DealAction, payload: DealPayload) => Promise<boolean>;
}) {
  const missing = needsNextStep(lead);
  const due = formatDealDueAt(lead.next_action_at);
  const touch = formatLastTouch({
    last_action_at: lead.last_action_at,
    last_action: lead.last_action,
    note: lastTouch.note,
    actorEmail: lastTouch.actorEmail
  });

  return (
    <tr
      data-testid={`deal-row-${lead.id}`}
      className="group cursor-pointer border-b border-slate-100 hover:bg-slate-50"
      onClick={onOpen}
    >
      <td className="px-3 py-2.5 align-top">
        <div className="font-medium text-slate-900">{lead.name || lead.email}</div>
        <div className="text-xs text-slate-500">{formatShowedDate(lead.call_showed_at)}</div>
      </td>
      <td className="px-3 py-2.5 align-top">
        <DealStagePill stage={lead.post_call_status} />
      </td>
      <td className="px-3 py-2.5 align-top">
        {missing ? (
          preview ? (
            <span className="text-xs font-medium text-amber-800">Set next step</span>
          ) : (
            <button
              type="button"
              data-testid="deal-set-next-step"
              className="text-xs font-medium text-amber-800 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                const btn = (e.currentTarget.closest("tr") as HTMLElement | null)
                  ?.querySelector<HTMLButtonElement>('[data-testid="deal-log-follow-up"]');
                btn?.click();
              }}
            >
              Set next step
            </button>
          )
        ) : (
          <div>
            <div className="text-sm text-slate-800">{lead.next_step}</div>
            <div
              className={`text-xs ${overdue ? "text-red-600" : "text-slate-500"}`}
              data-testid="deal-due"
            >
              {due}
            </div>
          </div>
        )}
      </td>
      <td className="max-w-[16rem] px-3 py-2.5 align-top">
        <div className="truncate text-xs text-slate-600" title={touch}>
          {touch || "—"}
        </div>
      </td>
      <td className="px-3 py-2.5 align-top">
        <DealOwnerAvatar email={ownerEmail} />
      </td>
      <td className="px-3 py-2.5 align-top text-sm tabular-nums text-slate-800">
        {lead.deal_value != null ? formatCurrencyNullable(lead.deal_value) : ""}
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className={`${preview ? "" : "opacity-0 group-hover:opacity-100"}`}>
          <DealQuickActions
            lead={lead}
            members={members}
            preview={preview}
            onSave={onSave}
          />
        </div>
      </td>
    </tr>
  );
}
