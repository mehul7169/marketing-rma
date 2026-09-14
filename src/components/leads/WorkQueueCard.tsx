"use client";

import { useState } from "react";
import ActionStatusBadge from "@/components/leads/ActionStatusBadge";
import WorkQueueLeadActions from "@/components/leads/WorkQueueLeadActions";
import type { LeadActivityRow } from "@/lib/db/lead_activities";
import type { LeadRow } from "@/lib/leads/types";
import { formatDueFriendly, formatISTDateTime } from "@/lib/timezone";

export default function WorkQueueCard({
  lead,
  activities,
  extraFields
}: {
  lead: LeadRow;
  activities: LeadActivityRow[];
  /** Extra fields driven by table-view visible columns (beyond core status). */
  extraFields?: Array<{ id: string; label: string; value: string }>;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <a
            href={`/leads/${lead.id}`}
            className="text-sm font-semibold text-slate-900 hover:underline"
          >
            {lead.name || lead.email}
          </a>
          <div className="mt-1 text-xs text-slate-600">
            {lead.phone || "—"} · {lead.email}
          </div>
        </div>
        <ActionStatusBadge actionStatus={lead.action_status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
        {extraFields && extraFields.length > 0 ? (
          extraFields.map((f) => (
            <div key={f.id}>
              <dt className="text-slate-400">{f.label}</dt>
              <dd className="mt-0.5 text-slate-800">{f.value}</dd>
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
