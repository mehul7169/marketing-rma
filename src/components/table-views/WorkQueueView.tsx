"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
import { filterWorkQueueLeads } from "@/lib/leads/workQueueSearch";
import { DEFAULT_COLUMNS } from "@/lib/table-views/registry";
import type { TableColumnConfig, TableViewBootstrap } from "@/lib/table-views/types";
import type { LeadRow } from "@/lib/leads/types";

const SEARCH_DEBOUNCE_MS = 175;

/**
 * Shared column prefs for Work Queue cards + table.
 * One useTableView instance — Cards/Table toggle is local state so switching
 * views does not remount or re-fetch column config.
 *
 * Search is client-side (full tab already loaded) and scoped to the active tab.
 * Tab links omit `search=` so switching tabs clears the query.
 */
export default function WorkQueueView({
  initialViewMode = "cards",
  initialSearch = "",
  activeTabId,
  rows,
  activitiesByLead,
  orgName,
  tableViewBootstrap
}: {
  initialViewMode?: "cards" | "table";
  /** From ?search= — cleared when navigating to another tab. */
  initialSearch?: string;
  /** Used to keep ?tab= in sync when rewriting the URL on view/search updates. */
  activeTabId: string;
  rows: LeadRow[];
  activitiesByLead: Record<string, LeadActivityRow[]>;
  orgName?: string | null;
  tableViewBootstrap?: TableViewBootstrap | null;
}) {
  const [viewMode, setViewMode] = useState<"cards" | "table">(initialViewMode);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", activeTabId);
      url.searchParams.set("view", viewMode);
      const trimmed = debouncedSearch.trim();
      if (trimmed) url.searchParams.set("search", trimmed);
      else url.searchParams.delete("search");
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch {
      // ignore
    }
  }, [activeTabId, viewMode, debouncedSearch]);

  const filteredRows = useMemo(
    () => filterWorkQueueLeads(rows, debouncedSearch),
    [rows, debouncedSearch]
  );

  const view = useTableView("leads-queue", {
    defaultColumns: DEFAULT_COLUMNS["leads-queue"],
    bootstrap: tableViewBootstrap
  });

  const setMode = useCallback((mode: "cards" | "table") => {
    setViewMode(mode);
  }, []);

  const tableColumns = ensureActionsColumn(view.visibleColumns);
  const hasSearch = debouncedSearch.trim().length > 0;

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label className="sr-only" htmlFor="work-queue-search">
        Search leads
      </label>
      <input
        id="work-queue-search"
        type="search"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search name, email, or phone"
        className="min-w-[200px] flex-1 rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-900 sm:max-w-xs"
        autoComplete="off"
      />
      <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );

  const emptyMessage = hasSearch
    ? "No leads in this tab match your search."
    : "Nothing in this queue tab.";

  if (filteredRows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {toolbar}
        <p className="rounded border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
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
            {filteredRows.map((lead) => (
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
          {filteredRows.map((lead) => (
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
