"use client";

import { Fragment, useCallback, useState } from "react";
import ColumnPicker from "@/components/table-views/ColumnPicker";
import ScrollableDataTable from "@/components/table-views/ScrollableDataTable";
import {
  LeadTableHeaderCell,
  leadCardFieldValue,
  renderLeadColumnCell
} from "@/components/table-views/leadColumnCells";
import WorkQueueCard from "@/components/leads/WorkQueueCard";
import WorkQueueLeadActions from "@/components/leads/WorkQueueLeadActions";
import { useTableView } from "@/hooks/useTableView";
import type { LeadActivityRow } from "@/lib/db/lead_activities";
import { DEFAULT_COLUMNS } from "@/lib/table-views/registry";
import type { TableColumnConfig, TableViewBootstrap } from "@/lib/table-views/types";
import type { LeadRow } from "@/lib/leads/types";

/**
 * Shared column prefs for Work Queue cards + table.
 * One useTableView instance — Cards/Table toggle is local state so switching
 * views does not remount or re-fetch column config.
 */
export default function WorkQueueView({
  initialViewMode = "cards",
  activeTabId,
  rows,
  activitiesByLead,
  orgName,
  tableViewBootstrap
}: {
  initialViewMode?: "cards" | "table";
  /** Used to keep ?tab= in sync when rewriting the URL on view toggle. */
  activeTabId: string;
  rows: LeadRow[];
  activitiesByLead: Record<string, LeadActivityRow[]>;
  orgName?: string | null;
  tableViewBootstrap?: TableViewBootstrap | null;
}) {
  const [viewMode, setViewMode] = useState<"cards" | "table">(initialViewMode);

  const view = useTableView("leads-queue", {
    defaultColumns: DEFAULT_COLUMNS["leads-queue"],
    bootstrap: tableViewBootstrap
  });

  const setMode = useCallback(
    (mode: "cards" | "table") => {
      setViewMode(mode);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", activeTabId);
        url.searchParams.set("view", mode);
        window.history.replaceState(null, "", url.pathname + url.search);
      } catch {
        // ignore
      }
    },
    [activeTabId]
  );

  const tableColumns = ensureActionsColumn(view.visibleColumns);

  const toolbar = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("cards")}
          className={`rounded border px-3 py-1.5 text-sm ${
            viewMode === "cards"
              ? "ui-active"
              : "border-slate-200 text-slate-700"
          }`}
        >
          Cards
        </button>
        <button
          type="button"
          onClick={() => setMode("table")}
          className={`rounded border px-3 py-1.5 text-sm ${
            viewMode === "table"
              ? "ui-active"
              : "border-slate-200 text-slate-700"
          }`}
        >
          Table
        </button>
      </div>
      <ColumnPicker view={view} />
    </div>
  );

  if (rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {toolbar}
        <p className="rounded border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          Nothing in this queue tab.
        </p>
      </div>
    );
  }

  if (viewMode === "cards") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="shrink-0">{toolbar}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((lead) => (
              <WorkQueueCard
                key={lead.id}
                lead={lead}
                activities={activitiesByLead[lead.id] ?? []}
                extraFields={visibleCardFields(
                  view.visibleColumns,
                  view.labelFor,
                  lead,
                  orgName
                )}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollableDataTable toolbar={toolbar}>
      <table className="min-w-[900px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-700">
            {tableColumns.map((col) => (
              <LeadTableHeaderCell
                key={col.id}
                columnId={col.id}
                label={
                  col.id === "actions" ? "Actions" : view.labelFor(col.id)
                }
              />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((lead) => (
            <tr key={lead.id} className="hover:bg-slate-50/60">
              {tableColumns.map((col) =>
                col.id === "actions" ? (
                  <td
                    key={col.id}
                    className="min-w-[200px] px-3 py-2 align-top"
                  >
                    <WorkQueueLeadActions lead={lead} compact />
                  </td>
                ) : (
                  <Fragment key={col.id}>
                    {renderLeadColumnCell(col.id, lead, {
                      orgName,
                      compactName: true
                    })}
                  </Fragment>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollableDataTable>
  );
}

function ensureActionsColumn(
  columns: TableColumnConfig[]
): TableColumnConfig[] {
  if (columns.some((c) => c.id === "actions")) return columns;
  return [...columns, { id: "actions", visible: true, width: null }];
}

function visibleCardFields(
  columns: TableColumnConfig[],
  labelFor: (id: string) => string,
  lead: LeadRow,
  orgName?: string | null
): Array<{ id: string; label: string; value: string }> {
  const skip = new Set(["name", "action_status", "actions"]);
  const out: Array<{ id: string; label: string; value: string }> = [];
  for (const col of columns) {
    if (!col.visible || skip.has(col.id)) continue;
    const value = leadCardFieldValue(col.id, lead, orgName);
    if (value == null) continue;
    out.push({ id: col.id, label: labelFor(col.id), value });
  }
  return out;
}
