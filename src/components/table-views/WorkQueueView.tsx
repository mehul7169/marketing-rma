"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useOrgPreview } from "@/components/admin/OrgPreviewContext";
import ConfirmPopover from "@/components/leads/ConfirmPopover";
import CreateLeadButton from "@/components/leads/CreateLeadButton";
import LeadDrawerHost from "@/components/leads/LeadDrawer";
import { useFilterPending } from "@/components/leads/FilterPending";
import { useFilterSearch } from "@/components/leads/useFilterSearch";
import { useLeadGrid } from "@/components/leads/useLeadGrid";
import WorkQueueCard from "@/components/leads/WorkQueueCard";
import WorkQueueLeadActions from "@/components/leads/WorkQueueLeadActions";
import ColumnPicker from "@/components/table-views/ColumnPicker";
import ScrollableDataTable from "@/components/table-views/ScrollableDataTable";
import {
  LeadTableHeaderCell,
  leadCardFieldValue,
  renderLeadColumnCell
} from "@/components/table-views/leadColumnCells";
import AsyncStatusIndicator from "@/components/ui/AsyncStatusIndicator";
import Spinner from "@/components/ui/Spinner";
import { toastSuccess } from "@/components/ui/Toast";
import Pagination from "@/components/ui/Pagination";
import { useTableView } from "@/hooks/useTableView";
import type { LeadActivityRow } from "@/lib/db/lead_activities";
import {
  followUpState,
  isFormUnqualified,
  pipelineStageOf
} from "@/lib/leads/lifecycleDefinitions";
import { DEFAULT_COLUMNS } from "@/lib/table-views/registry";
import type { TableColumnConfig, TableViewBootstrap } from "@/lib/table-views/types";
import type { LeadRow } from "@/lib/leads/types";
import { queueQueryParams, type QueueSort } from "@/lib/leads/workQueueParams";
import { useRouter } from "next/navigation";

export default function WorkQueueView({
  initialViewMode = "table",
  initialSearch = "",
  activeTabId,
  statusFilterId = null,
  showFormUnqualified = false,
  sort = "newest",
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
  showFormUnqualified?: boolean;
  sort?: QueueSort;
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
  const { pending, start } = useFilterPending();
  const [viewMode, setViewMode] = useState<"cards" | "table">(initialViewMode);
  const search = useFilterSearch({
    urlValue: initialSearch,
    onCommit: (q, { isLatest, immediate }) => {
      start(() => {
        if (!isLatest()) return;
        const url = new URL(window.location.href);
        url.searchParams.set("view", viewMode);
        url.searchParams.delete("page");
        if (q) url.searchParams.set("search", q);
        else url.searchParams.delete("search");
        const href = url.pathname + url.search;
        if (immediate) router.push(href);
        else router.replace(href);
      });
    }
  });
  const belongs = useCallback(
    (lead: LeadRow) =>
      leadBelongsInView(lead, activeTabId, statusFilterId, showFormUnqualified),
    [activeTabId, statusFilterId, showFormUnqualified]
  );
  const grid = useLeadGrid(rows, { belongs });
  const localRows = grid.rows;
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

  const paginationQuery = useMemo(
    () =>
      queueQueryParams({
        view: viewMode,
        tab: activeTabId,
        filter: statusFilterId,
        showFormUnqualified,
        search: initialSearch,
        sort
      }),
    [activeTabId, statusFilterId, showFormUnqualified, initialSearch, viewMode, sort]
  );

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

  const applyLeadPatch = grid.applyLead;
  const restoreLead = grid.restore;
  const filteredRows = localRows;

  const view = useTableView("leads-queue", {
    defaultColumns: DEFAULT_COLUMNS["leads-queue"],
    bootstrap: tableViewBootstrap
  });

  const setMode = useCallback((mode: "cards" | "table") => {
    setViewMode(mode);
  }, []);

  const onLeadCreated = useCallback(
    (lead: LeadRow) => {
      if (leadBelongsInView(lead, activeTabId, statusFilterId, showFormUnqualified)) {
        grid.applyLead(lead.id, lead);
        toastSuccess(`Created ${lead.name ?? "lead"}`);
      } else {
        toastSuccess(
          `Created ${lead.name ?? "lead"} — it's in the default Work Queue view (New), not this tab.`
        );
      }
    },
    [activeTabId, statusFilterId, showFormUnqualified, grid]
  );

  const tableColumns = view.visibleColumns;
  const hasSearch = initialSearch.trim().length > 0;
  const editDisabled = preview.active;

  const tableMinWidth = tableColumns.reduce((sum, col) => {
    const w = typeof col.width === "number" && col.width > 0 ? col.width : 120;
    return sum + w;
  }, 0);

  const editHandlersFor = grid.editHandlersFor;

  const pagination = (
    <div className="shrink-0" data-testid="queue-pagination" data-total={total}>
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
      <label className="relative w-full max-w-xs shrink-0">
        <span className="sr-only" id="work-queue-search-label">
          Search leads
        </span>
        <input
          id="work-queue-search"
          data-testid="work-queue-search"
          type="search"
          aria-labelledby="work-queue-search-label"
          value={search.draft}
          onChange={(e) => search.onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search.onEnter();
            }
          }}
          placeholder="Search name, email, or phone"
          className="w-full rounded border border-slate-200 px-3 py-1.5 pr-8 text-sm text-slate-900"
          autoComplete="off"
        />
        {pending ? (
          <span
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            data-testid="search-pending"
          >
            <Spinner size="xs" label="Searching" />
          </span>
        ) : null}
      </label>
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
        <CreateLeadButton disabled={preview.active} onCreated={onLeadCreated} />
      </div>
    </div>
  );

  const emptyMessage = hasSearch
    ? "No leads match your search in this view."
    : "Nothing in this queue view.";

  const pendingClass = pending ? "pointer-events-none opacity-60" : "";

  if (filteredRows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {toolbar}
        <p
          className={`rounded border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 ${pendingClass}`}
          aria-busy={pending}
        >
          {emptyMessage}
        </p>
        {pagination}
        <LeadDrawerHost onLeadPatched={(lead) => grid.applyLead(lead.id, lead)} />
      </div>
    );
  }

  if (viewMode === "cards") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="shrink-0">{toolbar}</div>
        <div className={`min-h-0 flex-1 overflow-y-auto ${pendingClass}`} aria-busy={pending}>
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredRows.map((lead) => (
              <WorkQueueCard
                key={lead.id}
                lead={lead}
                activities={activitiesByLead[lead.id] ?? []}
                editDisabled={editDisabled}
                saveStatus={rowStatus[lead.id] ?? "idle"}
                onPlainField={editHandlersFor(lead).onPlainField}
                onCustomField={editHandlersFor(lead).onCustomField}
                onLeadPatched={(patch) => applyLeadPatch(lead.id, patch)}
                onLeadRollback={(snapshot) => restoreLead(snapshot)}
                onSaveStart={() => markSaving(lead.id)}
                onSaveEnd={(ok) =>
                  ok ? markSaved(lead.id) : clearRowStatus(lead.id)
                }
                extraFields={visibleCardFields(
                  view.visibleColumns,
                  view.labelFor,
                  lead,
                  orgName
                )}
                onOpen={() => grid.openDrawer(lead.id)}
              />
            ))}
          </div>
        </div>
        {pagination}
        {grid.confirm ? (
          <ConfirmPopover
            title={grid.confirm.title}
            message={grid.confirm.message}
            confirmLabel={grid.confirm.confirmLabel}
            reasonRequired={grid.confirm.reasonRequired}
            reasonLabel={grid.confirm.reasonLabel}
            showDeadReason={grid.confirm.showDeadReason}
            anchor={grid.confirm.anchor}
            onConfirm={grid.resolveConfirm}
            onCancel={() => grid.setConfirm(null)}
          />
        ) : null}
        <LeadDrawerHost onLeadPatched={(lead) => grid.applyLead(lead.id, lead)} />
      </div>
    );
  }

  return (
    <>
      <ScrollableDataTable toolbar={toolbar}>
        <div className={pendingClass} aria-busy={pending}>
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
                data-testid="work-queue-row"
                data-lead-id={lead.id}
                data-created-at={lead.created_at}
                data-next-action-at={lead.next_action_at ?? ""}
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
                  grid.openDrawer(lead.id);
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
                        edit: editHandlersFor(lead)
                      })}
                    </Fragment>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </ScrollableDataTable>
      <div className="shrink-0 pt-2">{pagination}</div>
      {grid.confirm ? (
        <ConfirmPopover
          title={grid.confirm.title}
          message={grid.confirm.message}
          confirmLabel={grid.confirm.confirmLabel}
          reasonRequired={grid.confirm.reasonRequired}
          reasonLabel={grid.confirm.reasonLabel}
          showDeadReason={grid.confirm.showDeadReason}
          anchor={grid.confirm.anchor}
          onConfirm={grid.resolveConfirm}
          onCancel={() => grid.setConfirm(null)}
        />
      ) : null}
      <LeadDrawerHost onLeadPatched={(lead) => grid.applyLead(lead.id, lead)} />
    </>
  );
}

function visibleCardFields(
  columns: TableColumnConfig[],
  labelFor: (id: string) => string,
  lead: LeadRow,
  orgName?: string | null
): Array<{ id: string; label: string; value: string }> {
  const skip = new Set(["name", "stage", "actions"]);
  const out: Array<{ id: string; label: string; value: string }> = [];
  for (const col of columns) {
    if (!col.visible || skip.has(col.id)) continue;
    const value = leadCardFieldValue(col.id, lead, orgName);
    if (value == null) continue;
    out.push({ id: col.id, label: labelFor(col.id), value });
  }
  return out;
}

/** Client mirror of the queue page's server filters (optimistic add/remove). */
function leadBelongsInView(
  lead: LeadRow,
  tabId: string,
  statusFilterId: string | null | undefined,
  showFormUnqualified: boolean
): boolean {
  if (lead.is_dead) return false;

  if (tabId === "meetings_booked") {
    if (!lead.call_scheduled_for) return false;
    return new Date(lead.call_scheduled_for).getTime() > Date.now();
  }
  if (tabId === "follow_ups_due") {
    const state = followUpState(lead.next_action_at);
    return state === "overdue" || state === "today";
  }

  if (!showFormUnqualified && isFormUnqualified(lead)) return false;
  if (statusFilterId === "new" || statusFilterId === "contacted") {
    return pipelineStageOf(lead) === statusFilterId;
  }
  if (statusFilterId === "upcoming") {
    return followUpState(lead.next_action_at) === "upcoming";
  }
  return true;
}
