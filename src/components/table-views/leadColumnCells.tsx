"use client";

import type { ReactNode } from "react";
import CopyValue from "@/components/CopyValue";
import ActionStatusBadge from "@/components/leads/ActionStatusBadge";
import DueFollowUpBadge from "@/components/leads/DueFollowUpBadge";
import RecordingLinkBadge from "@/components/leads/RecordingLinkBadge";
import ReviveLeadButton from "@/components/leads/ReviveLeadButton";
import StageBadge from "@/components/leads/StageBadge";
import type { LeadReminder } from "@/lib/leads/types";
import type { LeadRow as Lead } from "@/lib/leads/types";
import {
  customFieldKeyFromColumnId,
  isCustomFieldColumnId
} from "@/lib/table-views/types";
import {
  formatDueFriendly,
  formatISTDateTime
} from "@/lib/timezone";

function fmtWhen(iso: string | null | undefined): string {
  return formatISTDateTime(iso);
}

function formatCustomValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.trim() || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

export function renderLeadColumnCell(
  columnId: string,
  lead: Lead,
  ctx: {
    dueReminders?: LeadReminder[];
    orgName?: string | null;
    /** denser name cell for queue table */
    compactName?: boolean;
  } = {}
): ReactNode {
  if (isCustomFieldColumnId(columnId)) {
    const key = customFieldKeyFromColumnId(columnId);
    const value = key ? lead.custom_fields?.[key] : undefined;
    return (
      <td className="max-w-[180px] truncate px-4 py-3 text-slate-700">
        {formatCustomValue(value)}
      </td>
    );
  }

  switch (columnId) {
    case "name":
      return (
        <td className="px-4 py-3 font-medium text-slate-900">
          {ctx.compactName ? (
            <>
              <a
                href={`/leads/${lead.id}`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {lead.name || lead.email}
              </a>
              <div className="text-xs font-normal text-slate-500">
                {lead.phone || "—"}
              </div>
            </>
          ) : (
            <>
              {lead.name || "—"}
              <DueFollowUpBadge reminders={ctx.dueReminders ?? []} />
              <RecordingLinkBadge url={lead.recording_url} />
            </>
          )}
        </td>
      );
    case "email":
      return (
        <td className="px-4 py-3 text-slate-700">
          <span className="inline-flex items-center gap-1">
            {lead.email}
            <CopyValue value={lead.email} hoverReveal />
          </span>
        </td>
      );
    case "phone":
      return (
        <td className="px-4 py-3 text-slate-700">
          <span className="inline-flex items-center gap-1">
            {lead.phone || "—"}
            <CopyValue value={lead.phone} hoverReveal />
          </span>
        </td>
      );
    case "lead_source":
      return (
        <td className="px-4 py-3 text-slate-700">{lead.lead_source || "—"}</td>
      );
    case "action_status":
      return (
        <td className="px-4 py-3">
          <ActionStatusBadge actionStatus={lead.action_status} />
        </td>
      );
    case "last_action":
      return (
        <td className="max-w-[160px] truncate px-4 py-3 text-slate-700">
          {lead.last_action || "—"}
        </td>
      );
    case "next_action":
      return (
        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
          {lead.next_action_at ? formatDueFriendly(lead.next_action_at) : "—"}
        </td>
      );
    case "contact_attempts":
      return (
        <td className="px-4 py-3 text-slate-700">
          {lead.contact_attempts ?? 0}
          {ctx.compactName && lead.last_action_at ? (
            <div className="text-xs text-slate-400">
              {formatISTDateTime(lead.last_action_at)}
            </div>
          ) : null}
        </td>
      );
    case "stage":
      return (
        <td className="px-4 py-3">
          <StageBadge stage={lead.stage} />
        </td>
      );
    case "created_at":
      return (
        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
          {fmtWhen(lead.created_at)}
        </td>
      );
    case "call_scheduled_for":
      return (
        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
          {fmtWhen(lead.call_scheduled_for)}
        </td>
      );
    case "call_booked_at":
      return (
        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
          {fmtWhen(lead.call_booked_at)}
        </td>
      );
    case "call_confirmed":
      return (
        <td className="px-4 py-3 text-slate-700">
          {lead.call_confirmed === true
            ? "Yes"
            : lead.call_confirmed === false
              ? "No"
              : "—"}
        </td>
      );
    case "qualified":
      return (
        <td className="px-4 py-3 text-slate-700">
          {lead.qualified === true
            ? "Yes"
            : lead.qualified === false
              ? "No"
              : "—"}
        </td>
      );
    case "is_dead":
      return (
        <td className="px-4 py-3 text-slate-700">
          {lead.is_dead ? "Yes" : "No"}
        </td>
      );
    case "notes":
      return (
        <td className="max-w-[180px] truncate px-4 py-3 text-slate-700">
          {lead.notes || "—"}
        </td>
      );
    case "recording_url":
      return (
        <td className="px-4 py-3">
          <RecordingLinkBadge url={lead.recording_url} />
        </td>
      );
    case "org_name":
      return (
        <td className="px-4 py-3 text-slate-700">{ctx.orgName || "—"}</td>
      );
    case "actions":
      return (
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {lead.is_dead ? <ReviveLeadButton leadId={lead.id} /> : null}
        </td>
      );
    default:
      return <td className="px-4 py-3 text-slate-400">—</td>;
  }
}

export function LeadTableHeaderCell({
  columnId,
  label
}: {
  columnId: string;
  label: string;
}) {
  return (
    <th key={columnId} className="px-4 py-3 text-left">
      {label}
    </th>
  );
}

/** Card field snippet for Work Queue — skips layout columns like actions. */
export function leadCardFieldValue(
  columnId: string,
  lead: Lead,
  orgName?: string | null
): string | null {
  if (columnId === "name" || columnId === "actions") return null;
  if (isCustomFieldColumnId(columnId)) {
    const key = customFieldKeyFromColumnId(columnId);
    return formatCustomValue(key ? lead.custom_fields?.[key] : undefined);
  }
  switch (columnId) {
    case "email":
      return lead.email;
    case "phone":
      return lead.phone || "—";
    case "lead_source":
      return lead.lead_source || "—";
    case "action_status":
      return null; // rendered as badge separately
    case "last_action":
      return lead.last_action || "—";
    case "next_action":
      return lead.next_action_at
        ? formatDueFriendly(lead.next_action_at)
        : "—";
    case "contact_attempts":
      return String(lead.contact_attempts ?? 0);
    case "stage":
      return lead.stage || "—";
    case "created_at":
      return fmtWhen(lead.created_at);
    case "call_scheduled_for":
      return fmtWhen(lead.call_scheduled_for);
    case "call_booked_at":
      return fmtWhen(lead.call_booked_at);
    case "call_confirmed":
      return lead.call_confirmed === true
        ? "Yes"
        : lead.call_confirmed === false
          ? "No"
          : "—";
    case "qualified":
      return lead.qualified === true
        ? "Yes"
        : lead.qualified === false
          ? "No"
          : "—";
    case "is_dead":
      return lead.is_dead ? "Yes" : "No";
    case "notes":
      return lead.notes || "—";
    case "org_name":
      return orgName || "—";
    default:
      return null;
  }
}
