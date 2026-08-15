"use client";

import { useMemo, useState } from "react";
import type { CreativeRow } from "@/lib/insights/metrics";
import { INSIGHTS_TOOLTIPS } from "@/lib/insights/tooltips";
import { formatCurrency, formatCurrencyNullable, formatInteger } from "@/lib/format";
import InfoTip from "@/components/InfoTip";

type SortKey =
  | "spend"
  | "callsBooked"
  | "qualified"
  | "showed"
  | "dealsClosed"
  | "revenue"
  | "costPerBooked"
  | "costPerDeal";

const COLUMNS: Array<[SortKey, string, string | null]> = [
  ["spend", "Spend", INSIGHTS_TOOLTIPS.creativeSpend],
  ["callsBooked", "Calls booked", INSIGHTS_TOOLTIPS.creativeCallsBooked],
  ["qualified", "Qualified", INSIGHTS_TOOLTIPS.creativeQualified],
  ["showed", "Showed", INSIGHTS_TOOLTIPS.creativeShowed],
  ["dealsClosed", "Deals closed", INSIGHTS_TOOLTIPS.creativeDealsClosed],
  ["revenue", "Revenue", null],
  ["costPerBooked", "Cost / booked", INSIGHTS_TOOLTIPS.creativeCostPerBooked],
  ["costPerDeal", "Cost / deal", INSIGHTS_TOOLTIPS.creativeCostPerDeal]
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
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span>Unmatched leads: {formatInteger(unmatchedLeadCount)}</span>
        <InfoTip text={INSIGHTS_TOOLTIPS.creativeUnmatched} />
        <span className="text-slate-400">
          (utm_content vs Meta ad name — not an ID match)
        </span>
      </p>
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-700">
              <th className="px-4 py-3 text-left font-medium">Creative name</th>
              {COLUMNS.map(([key, label, tip]) => (
                <th key={key} className="px-4 py-3 text-right font-medium">
                  <span className="inline-flex items-center justify-end gap-1">
                    <button
                      type="button"
                      className="hover:text-slate-900"
                      onClick={() => toggle(key)}
                    >
                      {label}
                      {sortKey === key ? (dir === "desc" ? " ↓" : " ↑") : ""}
                    </button>
                    {tip ? <InfoTip text={tip} /> : null}
                  </span>
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
      <td className={`px-4 py-3 ${cls}`}>
        <span className="inline-flex items-center gap-1.5">
          {row.name}
          {row.unmatched ? <InfoTip text={INSIGHTS_TOOLTIPS.creativeUnmatched} /> : null}
        </span>
      </td>
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
