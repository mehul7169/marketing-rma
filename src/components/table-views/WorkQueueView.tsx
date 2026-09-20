"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { saveLeadPlainFieldsAction } from "@/app/leads/actions";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import ColumnPicker from "@/components/table-views/ColumnPicker";
import ScrollableDataTable from "@/components/table-views/ScrollableDataTable";
import {
  LeadTableHeaderCell,
  isInlineEditableColumn,
  leadCardFieldValue,
  renderLeadColumnCell
} from "@/components/table-views/leadColumnCells";
import WorkQueueCard from "@/components/leads/WorkQueueCard";
import WorkQueueLeadActions from "@/components/leads/WorkQueueLeadActions";
import WorkQueueToast from "@/components/leads/WorkQueueToast";
import { useTableView } from "@/hooks/useTableView";
import type { LeadActivityRow } from "@/lib/db/lead_activities";
import { displayActionStatus } from "@/lib/leads/actionStatus";
import { filterWorkQueueLeads } from "@/lib/leads/workQueueSearch";
import { DEFAULT_COLUMNS } from "@/lib/table-views/registry";
import type { TableColumnConfig, TableViewBootstrap } from "@/lib/table-views/types";
import type { LeadRow } from "@/lib/leads/types";

const SEARCH_DEBOUNCE_MS = 175;

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
  initialSearch?: string;
  activeTabId: string;
  rows: LeadRow[];
  activitiesByLead: Record<string, LeadActivityRow[]>;
  orgName?: string | null;
  tableViewBootstrap?: TableViewBootstrap | null;
}) {
  const preview = useOrgPreview();
  const [viewMode, setViewMode] = useState<"cards" | "table">(initialViewMode);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [localRows, setLocalRows] = useState(rows);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

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

  const applyLeadPatch = useCallback(
    (leadId: string, patch: Partial<LeadRow>) => {
      setLocalRows((prev) => {
        const next = prev.map((l) =>
          l.id === leadId ? { ...l, ...patch } : l
        );
        // Status-scoped tabs drop leads that no longer match; All keeps them
        // (unless dead/closed — Work Queue never shows those).
        return next.filter((l) => leadBelongsOnTab(l, activeTabId));
      });
    },
    [activeTabId]
  );

  const restoreLead = useCallback((snapshot: LeadRow) => {
    setLocalRows((prev) => {
      const idx = prev.findIndex((l) => l.id === snapshot.id);
      if (idx === -1) {
        if (!leadBelongsOnTab(snapshot, activeTabId)) return prev;
        return [snapshot, ...prev];
      }
      const copy = [...prev];
      copy[idx] = snapshot;
      return copy;
    });
  }, [activeTabId]);

  const optimisticPatch = useCallback(
    (leadId: string, patch: Partial<LeadRow>, rollback: LeadRow) => {
      applyLeadPatch(leadId, patch);
      return () => restoreLead(rollback);
    },
    [applyLeadPatch, restoreLead]
  );

  const commitPlainField = useCallback(
    (
      lead: LeadRow,
      field: "name" | "email" | "phone" | "notes" | "deal_value",
      raw: string
    ) => {
      if (preview.active) return;
      const previous = lead;
      let patch: Partial<LeadRow> = {};
      let serverInput: Parameters<typeof saveLeadPlainFieldsAction>[1] = {};

      if (field === "deal_value") {
        const trimmed = raw.trim();
        const num = trimmed === "" ? null : Number(trimmed);
        if (trimmed !== "" && !Number.isFinite(num)) {
          setToast("Deal value must be a number");
          return;
        }
        patch = { deal_value: num };
        serverInput = { deal_value: num };
      } else if (field === "email") {
        const trimmed = raw.trim();
        if (!trimmed) {
          setToast("Email is required");
          return;
        }
        patch = { email: trimmed };
        serverInput = { email: trimmed };
      } else if (field === "name") {
        const v = raw.trim() || null;
        patch = { name: v };
        serverInput = { name: v };
      } else if (field === "phone") {
        const v = raw.trim() || null;
        patch = { phone: v };
        serverInput = { phone: v };
      } else {
        const v = raw.trim() || null;
        patch = { notes: v };
        serverInput = { notes: v };
      }

      const rollback = optimisticPatch(lead.id, patch, previous);
      void saveLeadPlainFieldsAction(lead.id, serverInput).catch((err) => {
        rollback();
        setToast(err instanceof Error ? err.message : "Save failed");
      });
    },
    [optimisticPatch, preview.active]
  );

  const commitCustomField = useCallback(
    (lead: LeadRow, key: string, raw: string) => {
      if (preview.active) return;
      const previous = lead;
      const custom_fields = {
        ...(lead.custom_fields ?? {}),
        [key]: raw.trim() || null
      };
      const rollback = optimisticPatch(lead.id, { custom_fields }, previous);
      void saveLeadPlainFieldsAction(lead.id, { custom_fields: { [key]: raw.trim() || null } }).catch(
        (err) => {
          rollback();
          setToast(err instanceof Error ? err.message : "Save failed");
        }
      );
    },
    [optimisticPatch, preview.active]
  );

  const filteredRows = useMemo(
    () => filterWorkQueueLeads(localRows, debouncedSearch),
    [localRows, debouncedSearch]
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
  const editDisabled = preview.active;

  const editHandlersFor = useCallback(
    (lead: LeadRow) => ({
      disabled: editDisabled,
      onPlainField: (
        field: "name" | "email" | "phone" | "notes" | "deal_value",
        value: string
      ) => commitPlainField(lead, field, value),
      onCustomField: (key: string, value: string) =>
        commitCustomField(lead, key, value)
    }),
    [commitCustomField, commitPlainField, editDisabled]
  );

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

  const toastEl = (
    <WorkQueueToast message={toast} onDismiss={() => setToast(null)} />
  );

  if (filteredRows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {toolbar}
        <p className="rounded border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </p>
        {toastEl}
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
                editDisabled={editDisabled}
                onPlainField={(field, value) =>
                  commitPlainField(lead, field, value)
                }
                onCustomField={(key, value) =>
                  commitCustomField(lead, key, value)
                }
                onLeadPatched={(patch) => applyLeadPatch(lead.id, patch)}
                onLeadRollback={(snapshot) => restoreLead(snapshot)}
                onError={(msg) => setToast(msg)}
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
        {toastEl}
      </div>
    );
  }

  return (
    <>
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
                      <WorkQueueLeadActions
                        lead={lead}
                        compact
                        onLeadPatched={(patch) => applyLeadPatch(lead.id, patch)}
                        onLeadRollback={(snapshot) => restoreLead(snapshot)}
                        onError={(msg) => setToast(msg)}
                      />
                    </td>
                  ) : (
                    <Fragment key={col.id}>
                      {renderLeadColumnCell(col.id, lead, {
                        orgName,
                        compactName: true,
                        edit: isInlineEditableColumn(col.id)
                          ? editHandlersFor(lead)
                          : undefined
                      })}
                    </Fragment>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableDataTable>
      {toastEl}
    </>
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

function leadBelongsOnTab(lead: LeadRow, tabId: string): boolean {
  if (lead.is_dead || lead.deal_closed === true) return false;
  if (tabId === "all") return true;
  if (tabId === "upcoming") {
    if (!lead.next_action_at) return false;
    // Keep simple: upcoming list is server-filtered; after patch keep if next_action future-ish
    return true;
  }
  const status = displayActionStatus(lead.action_status);
  if (tabId === "untouched") return status === "Untouched";
  if (tabId === "personally_contacted") return status === "Personally Contacted";
  if (tabId === "follow_up_due") return status === "Follow-up Due";
  if (tabId === "follow_up_overdue") return status === "Follow-up Overdue";
  return true;
}
