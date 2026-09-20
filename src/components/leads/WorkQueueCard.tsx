"use client";

import { useState } from "react";
import ActionStatusBadge from "@/components/leads/ActionStatusBadge";
import InlineEditableValue from "@/components/leads/InlineEditableValue";
import WorkQueueLeadActions from "@/components/leads/WorkQueueLeadActions";
import type { LeadActivityRow } from "@/lib/db/lead_activities";
import type { LeadRow } from "@/lib/leads/types";
import { formatDueFriendly, formatISTDateTime, toDatetimeLocalIST } from "@/lib/timezone";
import {
  customFieldKeyFromColumnId,
  isCustomFieldColumnId
} from "@/lib/table-views/types";
import { isInlineEditableColumn } from "@/components/table-views/leadColumnCells";

export default function WorkQueueCard({
  lead,
  activities,
  extraFields,
  editDisabled = false,
  onPlainField,
  onCustomField,
  onLeadPatched,
  onLeadRollback,
  onError
}: {
  lead: LeadRow;
  activities: LeadActivityRow[];
  extraFields?: Array<{ id: string; label: string; value: string }>;
  editDisabled?: boolean;
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
  onLeadPatched?: (patch: Partial<LeadRow>) => void;
  onLeadRollback?: (snapshot: LeadRow) => void;
  onError?: (message: string) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
              <InlineEditableValue
                className="font-semibold"
                value={lead.name ?? ""}
                displayValue={lead.name || lead.email}
                disabled={editDisabled || !onPlainField}
                onCommit={(next) => onPlainField?.("name", next)}
              />
            </div>
            <a
              href={`/leads/${lead.id}`}
              className="shrink-0 text-xs text-slate-400 hover:text-slate-700 hover:underline"
            >
              Open
            </a>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-600">
            <InlineEditableValue
              value={lead.phone ?? ""}
              displayValue={lead.phone || "—"}
              inputType="tel"
              disabled={editDisabled || !onPlainField}
              onCommit={(next) => onPlainField?.("phone", next)}
            />
            <span>·</span>
            <InlineEditableValue
              value={lead.email}
              inputType="email"
              disabled={editDisabled || !onPlainField}
              onCommit={(next) => onPlainField?.("email", next)}
            />
          </div>
        </div>
        <ActionStatusBadge actionStatus={lead.action_status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
        {extraFields && extraFields.length > 0 ? (
          extraFields.map((f) => (
            <div key={f.id}>
              <dt className="text-slate-400">{f.label}</dt>
              <dd className="mt-0.5 text-slate-800">
                {renderEditableExtra(f, lead, editDisabled, onPlainField, onCustomField)}
              </dd>
            </div>
          ))
        ) : (
          <>
            <div>
              <dt className="text-slate-400">Last action</dt>
              <dd className="mt-0.5 text-slate-800">{lead.last_action || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Next action</dt>
              <dd className="mt-0.5 text-slate-800">
                {lead.next_action_at
                  ? formatDueFriendly(lead.next_action_at)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Attempts</dt>
              <dd className="mt-0.5 text-slate-800">
                {lead.contact_attempts ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Source</dt>
              <dd className="mt-0.5 text-slate-800">{lead.lead_source || "—"}</dd>
            </div>
          </>
        )}
      </dl>

      <WorkQueueLeadActions
        lead={lead}
        showHistoryToggle
        historyOpen={historyOpen}
        onToggleHistory={() => setHistoryOpen((v) => !v)}
        onLeadPatched={onLeadPatched}
        onLeadRollback={onLeadRollback}
        onError={onError}
      />

      {historyOpen ? (
        <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
          {activities.length === 0 ? (
            <li>No activity yet.</li>
          ) : (
            activities.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-2">
                <span className="font-medium text-slate-800">{a.type}</span>
                {a.outcome ? <span>· {a.outcome}</span> : null}
                {a.note ? <span>· {a.note}</span> : null}
                <span className="text-slate-400">
                  {formatISTDateTime(a.created_at)}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </article>
  );
}

function renderEditableExtra(
  f: { id: string; label: string; value: string },
  lead: LeadRow,
  editDisabled: boolean,
  onPlainField?: (
    field:
      | "name"
      | "email"
      | "phone"
      | "notes"
      | "deal_value"
      | "call_scheduled_for",
    value: string
  ) => void,
  onCustomField?: (key: string, value: string) => void
) {
  if (editDisabled || !isInlineEditableColumn(f.id)) {
    return f.value;
  }

  if (isCustomFieldColumnId(f.id)) {
    const key = customFieldKeyFromColumnId(f.id);
    if (!key || !onCustomField) return f.value;
    const raw = lead.custom_fields?.[key];
    const asText =
      raw === null || raw === undefined
        ? ""
        : typeof raw === "string"
          ? raw
          : String(raw);
    return (
      <InlineEditableValue
        value={asText}
        displayValue={f.value}
        onCommit={(next) => onCustomField(key, next)}
      />
    );
  }

  if (f.id === "email" && onPlainField) {
    return (
      <InlineEditableValue
        value={lead.email}
        inputType="email"
        onCommit={(next) => onPlainField("email", next)}
      />
    );
  }
  if (f.id === "phone" && onPlainField) {
    return (
      <InlineEditableValue
        value={lead.phone ?? ""}
        displayValue={lead.phone || "—"}
        inputType="tel"
        onCommit={(next) => onPlainField("phone", next)}
      />
    );
  }
  if (f.id === "notes" && onPlainField) {
    return (
      <InlineEditableValue
        value={lead.notes ?? ""}
        displayValue={lead.notes || "—"}
        multiline
        onCommit={(next) => onPlainField("notes", next)}
      />
    );
  }
  if (f.id === "deal_value" && onPlainField) {
    return (
      <InlineEditableValue
        value={
          lead.deal_value !== null && lead.deal_value !== undefined
            ? String(lead.deal_value)
            : ""
        }
        displayValue={f.value}
        inputType="number"
        onCommit={(next) => onPlainField("deal_value", next)}
      />
    );
  }
  if (f.id === "call_scheduled_for" && onPlainField) {
    return (
      <InlineEditableValue
        value={toDatetimeLocalIST(lead.call_scheduled_for)}
        displayValue={formatISTDateTime(lead.call_scheduled_for)}
        inputType="datetime-local"
        onCommit={(next) => onPlainField("call_scheduled_for", next)}
      />
    );
  }

  return f.value;
}
