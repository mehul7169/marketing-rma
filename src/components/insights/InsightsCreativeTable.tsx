"use client";

import { useMemo, useState } from "react";
import type { CreativeRow } from "@/lib/insights/metrics";
import { formatCurrency, formatCurrencyNullable, formatInteger } from "@/lib/format";

type SortKey =
  | "spend"
  | "callsBooked"
  | "qualified"
  | "showed"
  | "dealsClosed"
  | "revenue"
  | "costPerBooked"
  | "costPerDeal";

const COLUMNS: Array<[SortKey, string]> = [
  ["spend", "Spend"],
  ["callsBooked", "Calls booked"],
  ["qualified", "Qualified"],
  ["showed", "Showed"],
  ["dealsClosed", "Deals closed"],
  ["revenue", "Revenue"],
  ["costPerBooked", "Cost / booked"],
  ["costPerDeal", "Cost / deal"]
];

function sortValue(row: CreativeRow, key: SortKey): number {
  const v = row[key];
  return v === null ? -Infinity : v;
}

export default function InsightsCreativeTable({
  rows,
  unmatchedLeadCount
}: {
  rows: CreativeRow[];
  unmatchedLeadCount: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const matched = useMemo(() => rows.filter((r) => !r.unmatched), [rows]);
  const unmatched = useMemo(() => rows.find((r) => r.unmatched) ?? null, [rows]);

  const sorted = useMemo(() => {
    const copy = [...matched];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      return dir === "asc" ? va - vb : vb - va;
    });
    return copy;
  }, [matched, sortKey, dir]);

  function toggle(key: SortKey) {
    if (sortKey === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDir("desc");
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Unmatched leads: {formatInteger(unmatchedLeadCount)}
        <span className="ml-1">
          (utm_content vs Meta ad name — not an ID match)
        </span>
      </p>
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-700">
              <th className="px-4 py-3 text-left font-medium">Creative name</th>
              {COLUMNS.map(([key, label]) => (
                <th key={key} className="px-4 py-3 text-right font-medium">
                  <button
                    type="button"
                    className="hover:text-slate-900"
                    onClick={() => toggle(key)}
                  >
                    {label}
                    {sortKey === key ? (dir === "desc" ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sorted.length === 0 && !unmatched ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No creatives in this range.
                </td>
              </tr>
            ) : (
              <>
                {sorted.map((row) => (
                  <CreativeCells key={row.key} row={row} />
                ))}
                {unmatched ? <CreativeCells row={unmatched} muted /> : null}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreativeCells({ row, muted }: { row: CreativeRow; muted?: boolean }) {
  const cls = muted ? "text-slate-500" : "text-slate-900";
  return (
    <tr className={muted ? "bg-slate-50/80" : undefined}>
      <td className={`px-4 py-3 ${cls}`}>{row.name}</td>
      <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${cls}`}>
        {formatCurrency(row.spend)}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${cls}`}>
        {formatInteger(row.callsBooked)}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${cls}`}>
        {formatInteger(row.qualified)}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${cls}`}>
        {formatInteger(row.showed)}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${cls}`}>
        {formatInteger(row.dealsClosed)}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${cls}`}>
        {formatCurrency(row.revenue)}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${cls}`}>
        {formatCurrencyNullable(row.costPerBooked)}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${cls}`}>
        {formatCurrencyNullable(row.costPerDeal)}
      </td>
    </tr>
  );
}
