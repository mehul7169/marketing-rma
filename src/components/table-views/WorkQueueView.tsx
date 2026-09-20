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
import AsyncStatusIndicator from "@/components/ui/AsyncStatusIndicator";
import Pagination from "@/components/ui/Pagination";
import { useTableView } from "@/hooks/useTableView";
import type { LeadActivityRow } from "@/lib/db/lead_activities";
import { displayActionStatus } from "@/lib/leads/actionStatus";
import { DEFAULT_COLUMNS } from "@/lib/table-views/registry";
import type { TableColumnConfig, TableViewBootstrap } from "@/lib/table-views/types";
import type { LeadRow } from "@/lib/leads/types";
import { fromDatetimeLocalIST } from "@/lib/timezone";
import { useRouter } from "next/navigation";

const SEARCH_DEBOUNCE_MS = 300;

export default function WorkQueueView({
  initialViewMode = "table",
  initialSearch = "",
  activeTabId,
  statusFilterId = null,
  page = 1,
  total = 0,
  pageSize = 50,
  rows,
  activitiesByLead,
  orgName,
  tableViewBootstrap
}: {
  initialViewMode?: "cards" | "table";
  initialSearch?: string;
  activeTabId: string;
  statusFilterId?: string | null;
  page?: number;
  total?: number;
  pageSize?: number;
  rows: LeadRow[];
  activitiesByLead: Record<string, LeadActivityRow[]>;
  orgName?: string | null;
  tableViewBootstrap?: TableViewBootstrap | null;
}) {
  const router = useRouter();
  const preview = useOrgPreview();
  const [viewMode, setViewMode] = useState<"cards" | "table">(initialViewMode);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [localRows, setLocalRows] = useState(rows);
  const [toast, setToast] = useState<string | null>(null);
  /** Per-lead async confirm status for optimistic saves. */
  const [rowStatus, setRowStatus] = useState<
    Record<string, "saving" | "saved">
  >({});

  const markSaving = useCallback((leadId: string) => {
    setRowStatus((prev) => ({ ...prev, [leadId]: "saving" }));
  }, []);

  const markSaved = useCallback((leadId: string) => {
    setRowStatus((prev) => ({ ...prev, [leadId]: "saved" }));
    window.setTimeout(() => {
      setRowStatus((prev) => {
        if (prev[leadId] !== "saved") return prev;
        const next = { ...prev };
        delete next[leadId];
        return next;
      });
    }, 900);
  }, []);

  const clearRowStatus = useCallback((leadId: string) => {
    setRowStatus((prev) => {
      if (!(leadId in prev)) return prev;
      const next = { ...prev };
      delete next[leadId];
      return next;
    });
  }, []);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  useEffect(() => {
    setSearchInput(initialSearch);
  }, [initialSearch]);

  /** Server-side search: navigate so RSC reloads the scoped page of results. */
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next === initialSearch.trim()) return;
      const url = new URL(window.location.href);
      url.searchParams.set("view", viewMode);
      url.searchParams.delete("page");
      if (next) url.searchParams.set("search", next);
      else url.searchParams.delete("search");
      router.push(url.pathname + url.search);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput, initialSearch, viewMode, router]);

  const paginationQuery = useMemo(() => {
    const q: Record<string, string> = { view: viewMode };
    if (activeTabId && activeTabId !== "all") q.tab = activeTabId;
    if (statusFilterId) q.filter = statusFilterId;
    if (initialSearch.trim()) q.search = initialSearch.trim();
    return q;
  }, [activeTabId, statusFilterId, initialSearch, viewMode]);

  useEffect(() => {
    // Keep view mode in the URL without a full navigation when toggling cards/table.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("view") === viewMode) return;
      url.searchParams.set("view", viewMode);
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch {
      // ignore
    }
  }, [viewMode]);

  const applyLeadPatch = useCallback(
    (leadId: string, patch: Partial<LeadRow>) => {
      setLocalRows((prev) => {
        const next = prev.map((l) =>
          l.id === leadId ? { ...l, ...patch } : l
        );
        return next.filter((l) =>
          leadBelongsInView(l, activeTabId, statusFilterId)
        );
      });
    },
    [activeTabId, statusFilterId]
  );

  const restoreLead = useCallback(
    (snapshot: LeadRow) => {
      setLocalRows((prev) => {
        const idx = prev.findIndex((l) => l.id === snapshot.id);
        if (idx === -1) {
          if (!leadBelongsInView(snapshot, activeTabId, statusFilterId)) {
            return prev;
          }
          return [snapshot, ...prev];
        }
        const copy = [...prev];
        copy[idx] = snapshot;
        return copy;
      });
    },
    [activeTabId, statusFilterId]
  );

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
      field:
        | "name"
        | "email"
        | "phone"
        | "notes"
        | "deal_value"
        | "call_scheduled_for",
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
      } else if (field === "call_scheduled_for") {
        const trimmed = raw.trim();
        let iso: string | null = null;
        if (trimmed) {
          try {
            iso = fromDatetimeLocalIST(trimmed);
          } catch {
            setToast("Invalid date/time");
            return;
          }
        }
        patch = { call_scheduled_for: iso };
        serverInput = { call_scheduled_for: iso };
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
      markSaving(lead.id);
      void saveLeadPlainFieldsAction(lead.id, serverInput)
        .then(() => markSaved(lead.id))
        .catch((err) => {
          rollback();
          clearRowStatus(lead.id);
          setToast(err instanceof Error ? err.message : "Save failed");
        });
    },
    [clearRowStatus, markSaved, markSaving, optimisticPatch, preview.active]
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
      markSaving(lead.id);
      void saveLeadPlainFieldsAction(lead.id, {
        custom_fields: { [key]: raw.trim() || null }
      })
        .then(() => markSaved(lead.id))
        .catch((err) => {
          rollback();
          clearRowStatus(lead.id);
          setToast(err instanceof Error ? err.message : "Save failed");
        });
    },
    [clearRowStatus, markSaved, markSaving, optimisticPatch, preview.active]
  );

  const filteredRows = localRows;

  const view = useTableView("leads-queue", {
    defaultColumns: DEFAULT_COLUMNS["leads-queue"],
    bootstrap: tableViewBootstrap
  });

  const setMode = useCallback((mode: "cards" | "table") => {
    setViewMode(mode);
  }, []);

  const tableColumns = ensureActionsColumn(view.visibleColumns);
  const hasSearch = initialSearch.trim().length > 0;
  const editDisabled = preview.active;

  const tableMinWidth = tableColumns.reduce((sum, col) => {
    const w = typeof col.width === "number" && col.width > 0 ? col.width : 120;
    return sum + w;
  }, 0);

  const editHandlersFor = useCallback(
    (lead: LeadRow) => ({
      disabled: editDisabled,
      onPlainField: (
        field:
          | "name"
          | "email"
          | "phone"
          | "notes"
          | "deal_value"
          | "call_scheduled_for",
        value: string
      ) => commitPlainField(lead, field, value),
      onCustomField: (key: string, value: string) =>
        commitCustomField(lead, key, value)
    }),
    [commitCustomField, commitPlainField, editDisabled]
  );

  const pagination = (
    <div className="shrink-0">
      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        pathname="/leads/queue"
        query={paginationQuery}
      />
    </div>
  );

  const toolbar = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <label className="sr-only" htmlFor="work-queue-search">
        Search leads
      </label>
      <input
        id="work-queue-search"
        type="search"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search name, email, or phone"
        className="w-full max-w-xs shrink-0 rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-900"
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
    ? "No leads match your search in this view."
    : "Nothing in this queue view.";

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
        {pagination}
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
                saveStatus={rowStatus[lead.id] ?? "idle"}
                onPlainField={(field, value) =>
                  commitPlainField(lead, field, value)
                }
                onCustomField={(key, value) =>
                  commitCustomField(lead, key, value)
                }
                onLeadPatched={(patch) => applyLeadPatch(lead.id, patch)}
                onLeadRollback={(snapshot) => restoreLead(snapshot)}
                onSaveStart={() => markSaving(lead.id)}
                onSaveEnd={(ok) =>
                  ok ? markSaved(lead.id) : clearRowStatus(lead.id)
                }
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
        {pagination}
        {toastEl}
      </div>
    );
  }

  return (
    <>
      <ScrollableDataTable toolbar={toolbar}>
        <table
          className="w-full border-collapse text-sm"
          style={{ tableLayout: "fixed", minWidth: tableMinWidth }}
        >
          <thead>
            <tr className="bg-slate-50 text-slate-700">
              {tableColumns.map((col) => (
                <LeadTableHeaderCell
                  key={col.id}
                  columnId={col.id}
                  label={
                    col.id === "actions" ? "Actions" : view.labelFor(col.id)
                  }
                  width={col.width}
                  onResize={view.setColumnWidth}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredRows.map((lead) => (
              <tr
                key={lead.id}
                className="cursor-pointer hover:bg-slate-50/60"
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (
                    t.closest(
                      "a, button, input, textarea, select, label, [data-no-row-nav]"
                    )
                  ) {
                    return;
                  }
                  window.location.href = `/leads/${lead.id}`;
                }}
              >
                {tableColumns.map((col) =>
                  col.id === "actions" ? (
                    <td
                      key={col.id}
                      className="px-3 py-2 align-top"
                      style={
                        typeof col.width === "number" && col.width > 0
                          ? { width: col.width }
                          : undefined
                      }
                      data-no-row-nav
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start gap-1.5">
                        <div className="min-w-0 flex-1">
                          <WorkQueueLeadActions
                            lead={lead}
                            compact
                            onLeadPatched={(patch) =>
                              applyLeadPatch(lead.id, patch)
                            }
                            onLeadRollback={(snapshot) => restoreLead(snapshot)}
                            onSaveStart={() => markSaving(lead.id)}
                            onSaveEnd={(ok) =>
                              ok ? markSaved(lead.id) : clearRowStatus(lead.id)
                            }
                            onError={(msg) => setToast(msg)}
                          />
                        </div>
                        <div className="pt-1.5">
                          <AsyncStatusIndicator
                            status={rowStatus[lead.id] ?? "idle"}
                          />
                        </div>
                      </div>
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
      <div className="shrink-0 pt-2">{pagination}</div>
      {toastEl}
    </>
  );
}

function ensureActionsColumn(
  columns: TableColumnConfig[]
): TableColumnConfig[] {
  if (columns.some((c) => c.id === "actions")) return columns;
  return [...columns, { id: "actions", visible: true, width: 220 }];
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

function leadBelongsInView(
  lead: LeadRow,
  tabId: string,
  statusFilterId: string | null | undefined
): boolean {
  if (lead.is_dead || lead.deal_closed === true) return false;

  if (tabId === "meetings_booked") {
    if (!lead.call_scheduled_for) return false;
    return new Date(lead.call_scheduled_for).getTime() > Date.now();
  }
  if (tabId === "follow_ups_due") {
    const status = displayActionStatus(lead.action_status);
    return status === "Follow-up Due" || status === "Follow-up Overdue";
  }

  // Default "all" (+ optional status filter)
  if (statusFilterId === "untouched") {
    return displayActionStatus(lead.action_status) === "Untouched";
  }
  if (statusFilterId === "personally_contacted") {
    return displayActionStatus(lead.action_status) === "Personally Contacted";
  }
  if (statusFilterId === "upcoming") {
    return Boolean(lead.next_action_at);
  }
  return true;
}
