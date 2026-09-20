"use client";

import { Fragment } from "react";
import ColumnPicker from "@/components/table-views/ColumnPicker";
import ScrollableDataTable from "@/components/table-views/ScrollableDataTable";
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
  const compactName = pageKey === "leads-queue";
  const colCount = Math.max(view.visibleColumns.length, 1);
  const tableMinWidth = view.visibleColumns.reduce((sum, col) => {
    const w = typeof col.width === "number" && col.width > 0 ? col.width : 120;
    return sum + w;
  }, 0);

  return (
    <ScrollableDataTable toolbar={<ColumnPicker view={view} />}>
      <table
        className="w-full border-collapse text-sm"
        style={{ tableLayout: "fixed", minWidth: tableMinWidth }}
      >
        <thead>
          <tr className="bg-slate-50 text-slate-700">
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
        <tbody className="divide-y divide-slate-200">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={colCount}
                className="px-4 py-10 text-center text-slate-500"
              >
                No leads in this filter.
              </td>
            </tr>
          ) : (
            rows.map((lead) =>
              pageKey === "leads" ? (
                <LeadRow key={lead.id} href={`/leads/${lead.id}`}>
                  {view.visibleColumns.map((col) => (
                    <Fragment key={col.id}>
                      {renderLeadColumnCell(col.id, lead, {
                        dueReminders: dueByLead?.[lead.id] ?? [],
                        orgName,
                        compactName
                      })}
                    </Fragment>
                  ))}
                </LeadRow>
              ) : (
                <tr key={lead.id} className="hover:bg-slate-50/60">
                  {view.visibleColumns.map((col) => (
                    <Fragment key={col.id}>
                      {renderLeadColumnCell(col.id, lead, {
                        orgName,
                        compactName
                      })}
                    </Fragment>
                  ))}
                </tr>
              )
            )
          )}
        </tbody>
      </table>
    </ScrollableDataTable>
  );
}
