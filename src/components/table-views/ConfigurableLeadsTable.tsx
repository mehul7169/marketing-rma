"use client";

import { Fragment } from "react";
import ConfirmPopover from "@/components/leads/ConfirmPopover";
import LeadDrawerHost from "@/components/leads/LeadDrawer";
import { useLeadGrid } from "@/components/leads/useLeadGrid";
import { ToolbarTrailing } from "@/components/leads/ToolbarPortal";
import ColumnPicker from "@/components/table-views/ColumnPicker";
import ScrollableDataTable from "@/components/table-views/ScrollableDataTable";
import { FadeIn } from "@/components/ui/Enter";
import {
  LeadTableHeaderCell,
  renderLeadColumnCell
} from "@/components/table-views/leadColumnCells";
import LeadRow from "@/components/leads/LeadRow";
import { useTableView } from "@/hooks/useTableView";
import { DEFAULT_COLUMNS } from "@/lib/table-views/registry";
import type { TableViewBootstrap } from "@/lib/table-views/types";
import type { LeadReminder, LeadRow as Lead } from "@/lib/leads/types";

export default function ConfigurableLeadsTable({
  pageKey,
  rows,
  dueByLead,
  orgName,
  tableViewBootstrap
}: {
  pageKey: "leads" | "leads-queue";
  rows: Lead[];
  dueByLead?: Record<string, LeadReminder[]>;
  orgName?: string | null;
  tableViewBootstrap?: TableViewBootstrap | null;
}) {
  const view = useTableView(pageKey, {
    defaultColumns: DEFAULT_COLUMNS[pageKey],
    bootstrap: tableViewBootstrap
  });
  const grid = useLeadGrid(rows);
  const compactName = pageKey === "leads-queue";
  const colCount = Math.max(view.visibleColumns.length, 1);
  const tableMinWidth = view.visibleColumns.reduce((sum, col) => {
    const w = typeof col.width === "number" && col.width > 0 ? col.width : 120;
    return sum + w;
  }, 0);

  return (
    <>
      <ToolbarTrailing>
        <ColumnPicker view={view} variant="ghost" />
      </ToolbarTrailing>
      <FadeIn id="leads-table" className="flex min-h-0 flex-1 flex-col">
      <ScrollableDataTable>
        <table
          className="w-full border-collapse text-sm"
          style={{ tableLayout: "fixed", minWidth: tableMinWidth }}
        >
          <thead>
            <tr className="bg-surface-2 text-fg">
              {view.visibleColumns.map((col) => (
                <LeadTableHeaderCell
                  key={col.id}
                  columnId={col.id}
                  label={view.labelFor(col.id)}
                  width={col.width}
                  onResize={view.setColumnWidth}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {grid.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-4 py-10 text-center text-muted"
                >
                  No leads in this filter.
                </td>
              </tr>
            ) : (
              grid.rows.map((lead) => (
                <LeadRow
                  key={lead.id}
                  onOpen={() => grid.openDrawer(lead.id)}
                  fx={
                    grid.cellFx?.leadId === lead.id ? grid.cellFx.kind : null
                  }
                >
                  {view.visibleColumns.map((col) => (
                    <Fragment key={col.id}>
                      {renderLeadColumnCell(col.id, lead, {
                        dueReminders: dueByLead?.[lead.id] ?? [],
                        orgName,
                        compactName,
                        edit: grid.editHandlersFor(lead)
                      })}
                    </Fragment>
                  ))}
                </LeadRow>
              ))
            )}
          </tbody>
        </table>
      </ScrollableDataTable>
      </FadeIn>
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
