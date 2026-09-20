"use client";

import type { ReactNode } from "react";
import CopyValue from "@/components/CopyValue";
import ActionStatusBadge from "@/components/leads/ActionStatusBadge";
import DueFollowUpBadge from "@/components/leads/DueFollowUpBadge";
import InlineEditableValue from "@/components/leads/InlineEditableValue";
import RecordingLinkBadge from "@/components/leads/RecordingLinkBadge";
import ReviveLeadButton from "@/components/leads/ReviveLeadButton";
import StageBadge from "@/components/leads/StageBadge";
import { formatCurrencyNullable } from "@/lib/format";
import type { LeadReminder } from "@/lib/leads/types";
import type { LeadRow as Lead } from "@/lib/leads/types";
import {
  customFieldKeyFromColumnId,
  isCustomFieldColumnId
} from "@/lib/table-views/types";
import {
  formatDueFriendly,
  formatISTDateTime,
  toDatetimeLocalIST
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

export type LeadCellEditHandlers = {
  disabled?: boolean;
  onPlainField?: (
    field:
      | "name"
      | "email"
      | "phone"
      | "notes"
      | "deal_value"
      | "call_scheduled_for",
    value: string
  ) => void;
  onCustomField?: (key: string, value: string) => void;
};

export function renderLeadColumnCell(
  columnId: string,
  lead: Lead,
  ctx: {
    dueReminders?: LeadReminder[];
    orgName?: string | null;
    compactName?: boolean;
    edit?: LeadCellEditHandlers;
  } = {}
): ReactNode {
  const edit = ctx.edit;
  const canEdit = Boolean(edit && !edit.disabled);

  if (isCustomFieldColumnId(columnId)) {
    const key = customFieldKeyFromColumnId(columnId);
    const raw = key ? lead.custom_fields?.[key] : undefined;
    const asText =
      raw === null || raw === undefined
        ? ""
        : typeof raw === "string"
          ? raw
          : String(raw);
    return (
      <td className="max-w-[180px] px-4 py-3 text-slate-700">
        {canEdit && key ? (
          <InlineEditableValue
            value={asText}
            displayValue={formatCustomValue(raw)}
            onCommit={(next) => edit?.onCustomField?.(key, next)}
          />
        ) : (
          <span className="truncate">{formatCustomValue(raw)}</span>
        )}
      </td>
    );
  }

  switch (columnId) {
    case "name":
      return (
        <td className="px-4 py-3 font-medium text-slate-900">
          {ctx.compactName ? (
            <>
              <div className="flex items-center gap-1.5">
                {canEdit ? (
                  <InlineEditableValue
                    className="font-medium"
                    value={lead.name ?? ""}
                    displayValue={lead.name || "—"}
                    onCommit={(next) => edit?.onPlainField?.("name", next)}
                  />
                ) : (
                  <span>{lead.name || "—"}</span>
                )}
              </div>
              <div className="text-xs font-normal text-slate-500">
                {canEdit ? (
                  <InlineEditableValue
                    value={lead.phone ?? ""}
                    displayValue={lead.phone || "—"}
                    inputType="tel"
                    onCommit={(next) => edit?.onPlainField?.("phone", next)}
                  />
                ) : (
                  lead.phone || "—"
                )}
              </div>
            </>
          ) : (
            <>
              {canEdit ? (
                <InlineEditableValue
                  value={lead.name ?? ""}
                  displayValue={lead.name || "—"}
                  onCommit={(next) => edit?.onPlainField?.("name", next)}
                />
              ) : (
                lead.name || "—"
              )}
              <DueFollowUpBadge reminders={ctx.dueReminders ?? []} />
              <RecordingLinkBadge url={lead.recording_url} />
            </>
          )}
        </td>
      );
    case "email":
      return (
        <td className="px-4 py-3 text-slate-700">
          <span className="inline-flex w-full items-center gap-1">
            {canEdit ? (
              <InlineEditableValue
                value={lead.email}
                inputType="email"
                onCommit={(next) => edit?.onPlainField?.("email", next)}
              />
            ) : (
              lead.email
            )}
            <CopyValue value={lead.email} hoverReveal />
          </span>
        </td>
      );
    case "phone":
      return (
        <td className="px-4 py-3 text-slate-700">
          <span className="inline-flex w-full items-center gap-1">
            {canEdit ? (
              <InlineEditableValue
                value={lead.phone ?? ""}
                displayValue={lead.phone || "—"}
                inputType="tel"
                onCommit={(next) => edit?.onPlainField?.("phone", next)}
              />
            ) : (
              lead.phone || "—"
            )}
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
          {canEdit ? (
            <InlineEditableValue
              value={toDatetimeLocalIST(lead.call_scheduled_for)}
              displayValue={fmtWhen(lead.call_scheduled_for)}
              inputType="datetime-local"
              onCommit={(next) =>
                edit?.onPlainField?.("call_scheduled_for", next)
              }
            />
          ) : (
            fmtWhen(lead.call_scheduled_for)
          )}
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
        <td className="max-w-[180px] px-4 py-3 text-slate-700">
          {canEdit ? (
            <InlineEditableValue
              value={lead.notes ?? ""}
              displayValue={lead.notes || "—"}
              multiline
              onCommit={(next) => edit?.onPlainField?.("notes", next)}
            />
          ) : (
            <span className="truncate">{lead.notes || "—"}</span>
          )}
        </td>
      );
    case "deal_value":
      return (
        <td className="px-4 py-3 text-slate-700">
          {canEdit ? (
            <InlineEditableValue
              value={
                lead.deal_value !== null && lead.deal_value !== undefined
                  ? String(lead.deal_value)
                  : ""
              }
              displayValue={formatCurrencyNullable(lead.deal_value) || "—"}
              inputType="number"
              onCommit={(next) => edit?.onPlainField?.("deal_value", next)}
            />
          ) : (
            formatCurrencyNullable(lead.deal_value) || "—"
          )}
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
      return null;
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
    case "deal_value":
      return formatCurrencyNullable(lead.deal_value) || "—";
    case "org_name":
      return orgName || "—";
    default:
      return null;
  }
}

export function isInlineEditableColumn(columnId: string): boolean {
  if (isCustomFieldColumnId(columnId)) return true;
  return (
    columnId === "name" ||
    columnId === "email" ||
    columnId === "phone" ||
    columnId === "notes" ||
    columnId === "deal_value" ||
    columnId === "call_scheduled_for"
  );
}
