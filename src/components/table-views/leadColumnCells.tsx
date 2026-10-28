"use client";

import type { ReactNode } from "react";
import CopyValue from "@/components/CopyValue";
import DueFollowUpBadge from "@/components/leads/DueFollowUpBadge";
import InlineEditableValue from "@/components/leads/InlineEditableValue";
import RecordingLinkBadge from "@/components/leads/RecordingLinkBadge";
import ReviveLeadButton from "@/components/leads/ReviveLeadButton";
import StageActionMenu, {
  type StageMenuConfirm
} from "@/components/leads/StageActionMenu";
import { FollowUpDate, LeadStatusBadges } from "@/components/leads/StageBadge";
import type { GridConfirmSpec } from "@/components/leads/useLeadGrid";
import { lifecycleBlockReason } from "@/lib/leads/gridGuards";
import { formatCurrencyNullable } from "@/lib/format";
import {
  displayLeadEmail,
  isSyntheticQuickformEmail
} from "@/lib/leads/contactNormalize";
import type { LifecycleAction, LifecyclePayload } from "@/lib/leads/lifecycle";
import type { LeadReminder } from "@/lib/leads/types";
import type { LeadRow as Lead } from "@/lib/leads/types";
import { deadReasonLabel } from "@/lib/leads/types";
import {
  customFieldKeyFromColumnId,
  isCustomFieldColumnId
} from "@/lib/table-views/types";
import {
  formatDueFriendly,
  formatISTDateTime,
  fromDatetimeLocalIST,
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
    field: "notes" | "deal_value" | "call_scheduled_for",
    value: string
  ) => void;
  onCustomField?: (key: string, value: string) => void;
  onLifecycle?: (action: LifecycleAction, payload?: LifecyclePayload) => void;
  onConfirm?: (spec: GridConfirmSpec) => void;
  onOpenDrawer?: () => void;
};

function Cell({
  className,
  children
}: {
  columnId: string;
  edit?: LeadCellEditHandlers;
  className?: string;
  children: ReactNode;
}) {
  return (
    <td className={className ?? "px-4 py-3 text-slate-700"}>
      {children}
    </td>
  );
}

function YesNoDash({
  value,
  disabled,
  reasonFor,
  onChange,
  testId
}: {
  value: boolean | null;
  disabled?: boolean;
  reasonFor?: (v: boolean | null) => string | null;
  onChange: (v: boolean | null, el: HTMLElement) => void;
  testId?: string;
}) {
  const opt = (v: boolean | null, label: string) => {
    const reason = disabled ? undefined : reasonFor?.(v) ?? undefined;
    return (
    <button
      type="button"
      disabled={disabled || Boolean(reason)}
      title={reason}
      data-value={v === null ? "dash" : v ? "yes" : "no"}
      className={`rounded px-1.5 py-0.5 text-[11px] ${
        value === v
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        if (reason) return;
        if (value !== v) onChange(v, e.currentTarget);
      }}
    >
      {label}
    </button>
    );
  };
  return (
    <div className="inline-flex gap-0.5" data-no-row-nav data-testid={testId}>
      {opt(true, "Yes")}
      {opt(false, "No")}
      {opt(null, "—")}
    </div>
  );
}

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
      <Cell
        columnId={columnId}
        edit={edit}
        className="max-w-[180px] px-4 py-3 text-slate-700"
      >
        {canEdit && key ? (
          <InlineEditableValue
            value={asText}
            displayValue={formatCustomValue(raw)}
            onCommit={(next) => edit?.onCustomField?.(key, next)}
          />
        ) : (
          <span className="truncate">{formatCustomValue(raw)}</span>
        )}
      </Cell>
    );
  }

  switch (columnId) {
    case "name":
      return (
        <Cell
          columnId={columnId}
          edit={edit}
          className="px-4 py-3 font-medium text-slate-900"
        >
          <button
            type="button"
            className="text-left hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              edit?.onOpenDrawer?.();
            }}
          >
            {lead.name || "—"}
          </button>
          {ctx.compactName ? null : (
            <>
              <DueFollowUpBadge reminders={ctx.dueReminders ?? []} />
              <RecordingLinkBadge url={lead.recording_url} />
            </>
          )}
        </Cell>
      );
    case "email":
      return (
        <Cell columnId={columnId} edit={edit}>
          <span className="inline-flex w-full items-center gap-1">
            <span
              className={
                isSyntheticQuickformEmail(lead.email)
                  ? "italic text-slate-400"
                  : undefined
              }
              title={
                isSyntheticQuickformEmail(lead.email)
                  ? "Phone-only Quickform lead — no real email"
                  : undefined
              }
            >
              {displayLeadEmail(lead.email)}
            </span>
            {!isSyntheticQuickformEmail(lead.email) ? (
              <CopyValue value={lead.email} hoverReveal />
            ) : null}
          </span>
        </Cell>
      );
    case "phone":
      return (
        <Cell columnId={columnId} edit={edit}>
          <span className="inline-flex w-full items-center gap-1">
            {lead.phone || "—"}
            <CopyValue value={lead.phone} hoverReveal />
          </span>
        </Cell>
      );
    case "lead_source":
      return <Cell columnId={columnId} edit={edit}>{lead.lead_source || "—"}</Cell>;
    case "last_action":
      return (
        <Cell
          columnId={columnId}
          edit={edit}
          className="max-w-[160px] truncate px-4 py-3 text-slate-700"
        >
          {lead.last_action || "—"}
        </Cell>
      );
    case "next_action":
      return (
        <Cell
          columnId={columnId}
          edit={edit}
          className="whitespace-nowrap px-4 py-3 text-slate-700"
        >
          {canEdit ? (
            <InlineEditableValue
              value={toDatetimeLocalIST(lead.next_action_at)}
              displayValue={
                lead.next_action_at ? (
                  <FollowUpDate at={lead.next_action_at} />
                ) : (
                  "—"
                )
              }
              inputType="datetime-local"
              onCommit={(next) => {
                const trimmed = next.trim();
                if (!trimmed) return;
                try {
                  edit?.onLifecycle?.("set_follow_up", {
                    followUpAt: fromDatetimeLocalIST(trimmed)
                  });
                } catch {
                  /* invalid datetime-local is ignored */
                }
              }}
            />
          ) : (
            <FollowUpDate at={lead.next_action_at} />
          )}
        </Cell>
      );
    case "contact_attempts":
      return (
        <Cell columnId={columnId} edit={edit}>
          {lead.contact_attempts ?? 0}
          {ctx.compactName && lead.last_action_at ? (
            <div className="text-xs text-slate-400">
              {formatISTDateTime(lead.last_action_at)}
            </div>
          ) : null}
        </Cell>
      );
    case "stage":
      return (
        <Cell columnId={columnId} edit={edit} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <LeadStatusBadges lead={lead} />
            {canEdit ? (
              <StageActionMenu
                lead={lead}
                onRun={(action, payload) =>
                  edit?.onLifecycle?.(action, payload)
                }
                onConfirm={(spec: StageMenuConfirm) =>
                  edit?.onConfirm?.({
                    columnId: "stage",
                    action: spec.action,
                    payload: spec.payload,
                    title: spec.title,
                    message: spec.message,
                    reasonRequired: spec.reasonRequired,
                    showDeadReason: spec.showDeadReason,
                    confirmLabel: spec.confirmLabel,
                    anchor: spec.anchor
                  })
                }
              />
            ) : null}
          </div>
        </Cell>
      );
    case "created_at":
      return (
        <Cell
          columnId={columnId}
          edit={edit}
          className="whitespace-nowrap px-4 py-3 text-slate-700"
        >
          {fmtWhen(lead.created_at)}
        </Cell>
      );
    case "call_scheduled_for":
      return (
        <Cell
          columnId={columnId}
          edit={edit}
          className="whitespace-nowrap px-4 py-3 text-slate-700"
        >
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
        </Cell>
      );
    case "call_booked_at":
      return (
        <Cell
          columnId={columnId}
          edit={edit}
          className="whitespace-nowrap px-4 py-3 text-slate-700"
        >
          {fmtWhen(lead.call_booked_at)}
        </Cell>
      );
    case "form_qualified":
      return (
        <Cell columnId={columnId} edit={edit}>
          {lead.form_qualified === true
            ? "Yes"
            : lead.form_qualified === false
              ? "No"
              : "—"}
        </Cell>
      );
    case "qualified":
      return (
        <Cell columnId={columnId} edit={edit}>
            {canEdit ? (
              <YesNoDash
                value={lead.qualified}
                reasonFor={(v) => {
                  if (v === true) return lifecycleBlockReason(lead, "qualify");
                  if (v === false) return lifecycleBlockReason(lead, "disqualify");
                  return null;
                }}
                onChange={(v, el) => {
                  if (v === true) edit?.onLifecycle?.("qualify");
                  else if (v === false) {
                    edit?.onConfirm?.({
                      columnId: "qualified",
                      action: "disqualify",
                      payload: {},
                      title: "Mark unqualified",
                      message: "Marking Unqualified also moves this lead to Dead.",
                      confirmLabel: "Mark unqualified",
                      anchor: el
                    });
                  } else {
                    edit?.onConfirm?.({
                      columnId: "qualified",
                      action: "clear_qualification",
                      payload: {},
                      title: "Clear qualification",
                      message: "Clear the setter qualification on this lead?",
                      reasonRequired: true,
                      confirmLabel: "Clear",
                      anchor: el
                    });
                  }
                }}
              />
          ) : lead.qualified === true ? (
            "Yes"
          ) : lead.qualified === false ? (
            "No"
          ) : (
            "—"
          )}
        </Cell>
      );
    case "call_showed":
      return (
        <Cell columnId={columnId} edit={edit}>
            {canEdit ? (
              <YesNoDash
                value={lead.call_showed}
                testId="call-showed-yesno"
                reasonFor={(v) => {
                  if (v === true) return lifecycleBlockReason(lead, "mark_showed");
                  if (v === false) return lifecycleBlockReason(lead, "mark_no_show");
                  return null;
                }}
                onChange={(v, el) => {
                  if (v === true) edit?.onLifecycle?.("mark_showed");
                  else if (v === false) {
                    edit?.onConfirm?.({
                      columnId: "call_showed",
                      action: "mark_no_show",
                      payload: {},
                      title: "Mark no-show",
                      message: "Marking No-show also moves this lead to Dead.",
                      confirmLabel: "Mark no-show",
                      anchor: el
                    });
                  } else {
                    edit?.onConfirm?.({
                      columnId: "call_showed",
                      action: "clear_show",
                      payload: {},
                      title: "Clear show outcome",
                      message: "Clear the show outcome on this lead?",
                      reasonRequired: true,
                      confirmLabel: "Clear",
                      anchor: el
                    });
                  }
                }}
              />
          ) : lead.call_showed === true ? (
            "Yes"
          ) : lead.call_showed === false ? (
            "No"
          ) : (
            "—"
          )}
        </Cell>
      );
    case "is_dead":
      return (
        <Cell columnId={columnId} edit={edit}>
          {lead.is_dead ? (
            <span className="inline-flex items-center gap-1">
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-white">
                Dead
              </span>
              {lead.dead_reason ? (
                <span className="text-xs text-slate-500">
                  {deadReasonLabel(lead.dead_reason)}
                </span>
              ) : null}
            </span>
          ) : canEdit ? (
            <button
              type="button"
              className="text-[11px] text-slate-500 hover:text-slate-800"
              onClick={(e) => {
                e.stopPropagation();
                edit?.onConfirm?.({
                  columnId: "is_dead",
                  action: "mark_dead",
                  payload: {},
                  title: "Mark dead",
                  message: lead.call_booked_at
                    ? "This lead has a booked call. Mark it dead anyway?"
                    : "Mark this lead dead?",
                  showDeadReason: true,
                  confirmLabel: "Mark dead",
                  anchor: e.currentTarget
                });
              }}
            >
              —
            </button>
          ) : (
            "—"
          )}
        </Cell>
      );
    case "qualified_by":
      return (
        <Cell columnId={columnId} edit={edit}>
          {lead.qualified_by || "—"}
        </Cell>
      );
    case "notes":
      return (
        <Cell
          columnId={columnId}
          edit={edit}
          className="max-w-[180px] px-4 py-3 text-slate-700"
        >
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
        </Cell>
      );
    case "deal_value":
      return (
        <Cell columnId={columnId} edit={edit}>
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
        </Cell>
      );
    case "recording_url":
      return (
        <Cell columnId={columnId} edit={edit} className="px-4 py-3">
          <RecordingLinkBadge url={lead.recording_url} />
        </Cell>
      );
    case "org_name":
      return (
        <Cell columnId={columnId} edit={edit}>
          {ctx.orgName || "—"}
        </Cell>
      );
    case "actions":
      return (
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {lead.is_dead ? <ReviveLeadButton leadId={lead.id} lead={lead} /> : null}
        </td>
      );
    default:
      return <td className="px-4 py-3 text-slate-400">—</td>;
  }
}

export function LeadTableHeaderCell({
  columnId,
  label,
  width,
  onResize
}: {
  columnId: string;
  label: string;
  width?: number | null;
  onResize?: (columnId: string, width: number) => void;
}) {
  const style =
    typeof width === "number" && width > 0
      ? { width, minWidth: width, maxWidth: width }
      : undefined;

  return (
    <th
      key={columnId}
      className="relative px-4 py-3 text-left"
      style={style}
    >
      <span className="pr-2">{label}</span>
      {onResize ? (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${label}`}
          data-no-row-nav
          className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-sky-300/60"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startW =
              typeof width === "number" && width > 0
                ? width
                : (e.currentTarget.parentElement?.getBoundingClientRect()
                    .width ?? 120);

            function onMove(ev: MouseEvent) {
              onResize?.(columnId, startW + (ev.clientX - startX));
            }
            function onUp() {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            }
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
        />
      ) : null}
    </th>
  );
}

export function leadCardFieldValue(
  columnId: string,
  lead: Lead,
  orgName?: string | null
): string | null {
  if (columnId === "name" || columnId === "actions" || columnId === "stage") {
    return null;
  }
  if (isCustomFieldColumnId(columnId)) {
    const key = customFieldKeyFromColumnId(columnId);
    return formatCustomValue(key ? lead.custom_fields?.[key] : undefined);
  }
  switch (columnId) {
    case "email":
      return displayLeadEmail(lead.email);
    case "phone":
      return lead.phone || "—";
    case "lead_source":
      return lead.lead_source || "—";
    case "last_action":
      return lead.last_action || "—";
    case "next_action":
      return lead.next_action_at ? formatDueFriendly(lead.next_action_at) : "—";
    case "contact_attempts":
      return String(lead.contact_attempts ?? 0);
    case "created_at":
      return fmtWhen(lead.created_at);
    case "call_scheduled_for":
      return fmtWhen(lead.call_scheduled_for);
    case "call_booked_at":
      return fmtWhen(lead.call_booked_at);
    case "form_qualified":
      return lead.form_qualified === true
        ? "Yes"
        : lead.form_qualified === false
          ? "No"
          : "—";
    case "qualified":
      return lead.qualified === true
        ? "Yes"
        : lead.qualified === false
          ? "No"
          : "—";
    case "call_showed":
      return lead.call_showed === true
        ? "Yes"
        : lead.call_showed === false
          ? "No"
          : "—";
    case "is_dead":
      return lead.is_dead
        ? `Dead${lead.dead_reason ? ` · ${deadReasonLabel(lead.dead_reason)}` : ""}`
        : "—";
    case "qualified_by":
      return lead.qualified_by || "—";
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
    columnId === "notes" ||
    columnId === "deal_value" ||
    columnId === "call_scheduled_for" ||
    columnId === "next_action" ||
    columnId === "qualified" ||
    columnId === "call_showed" ||
    columnId === "is_dead" ||
    columnId === "stage"
  );
}
