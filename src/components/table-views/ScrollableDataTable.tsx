import type { ReactNode } from "react";

/**
 * Page shell for screens whose primary content is a wide data table.
 * Fills the remaining viewport under the app chrome so a child
 * ScrollableDataTable can flex:1 + overflow and keep its scrollbar
 * near the bottom of the screen.
 */
export function DataTablePageShell({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/**
 * Shared scrollport for wide data tables.
 * Parent must be in a flex column with a bounded height (use DataTablePageShell).
 * Horizontal + vertical scroll live here so the x-scrollbar stays at the
 * bottom of the viewport region, not after the last row.
 * Sticky thead is applied via `.scrollable-data-table` in globals.css.
 */
export default function ScrollableDataTable({
  children,
  toolbar,
  className = ""
}: {
  /** Typically a <table>…</table>. */
  children: ReactNode;
  /** Optional controls above the scrollport (e.g. Columns picker). */
  toolbar?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 ${className}`.trim()}>
      {toolbar ? (
        <div className="flex shrink-0 justify-end">{toolbar}</div>
      ) : null}
      <div className="scrollable-data-table min-h-0 flex-1 overflow-auto rounded border border-slate-200">
        {children}
      </div>
    </div>
  );
}
