"use client";

import { useMemo, useState } from "react";
import type { MetaAdsTableRow } from "@/lib/db/meta_ads_daily";

type SortKey =
  | "spend"
  | "impressions"
  | "reach"
  | "blended_cpm"
  | "clicks"
  | "ctr_percent"
  | "cpc"
  | "leads"
  | "lp_cvr_percent"
  | "cost_per_lead";

const numericKeys: SortKey[] = [
  "spend",
  "impressions",
  "reach",
  "blended_cpm",
  "clicks",
  "ctr_percent",
  "cpc",
  "leads",
  "lp_cvr_percent",
  "cost_per_lead"
];

function fmtMoney(v: number) {
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtPct(v: number) {
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function fmtMaybeMoney(v: number | null) {
  if (v === null) return "—";
  return fmtMoney(v);
}

function fmtMaybePct(v: number | null) {
  if (v === null) return "—";
  return fmtPct(v);
}

export default function MetaAdsTable({ rows }: { rows: MetaAdsTableRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = a[sortKey] as number | null;
      const vb = b[sortKey] as number | null;
      const na = va === null ? -Infinity : va;
      const nb = vb === null ? -Infinity : vb;
      return dir === "asc" ? na - nb : nb - na;
    });
    return copy;
  }, [rows, sortKey, dir]);

  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="min-w-[900px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-700">
            <th className="px-4 py-3 text-left">Campaign</th>
            <th className="px-4 py-3 text-left">Ad Set</th>
            {(
              [
                ["spend", "Adspend", (v: number) => fmtMoney(v)],
                ["impressions", "Impr", (v: number) => v.toLocaleString()],
                ["reach", "Reach", (v: number) => v.toLocaleString()],
                ["blended_cpm", "CPM", (v: number) => fmtMoney(v)],
                ["clicks", "Clicks", (v: number) => v.toLocaleString()],
                ["ctr_percent", "CTR%", (v: number) => fmtPct(v)],
                ["cpc", "CPC", (v: number) => fmtMoney(v)],
                ["leads", "Leads", (v: number) => v.toLocaleString()],
                ["cost_per_lead", "Lead Cost", (v: number | null) => fmtMaybeMoney(v)],
                ["lp_cvr_percent", "LP CVR%", (v: number) => fmtPct(v)]
              ] as Array<[SortKey, string, (v: any) => string]>
            ).map(([key, label]) => {
              const isActive = sortKey === key;
              return (
                <th
                  key={key}
                  className="px-4 py-3 whitespace-nowrap cursor-pointer select-none text-right"
                  onClick={() => {
                    if (sortKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
                    else {
                      setSortKey(key);
                      setDir("desc");
                    }
                  }}
                  aria-sort={
                    isActive ? (dir === "asc" ? "ascending" : "descending") : "none"
                  }
                  title="Click to sort"
                >
                  <span className={isActive ? "text-blue-700 font-medium" : ""}>
                    {label}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={12} className="px-4 py-10 text-center text-slate-500">
                No data in this date range.
              </td>
            </tr>
          ) : (
            sorted.map((r) => (
              <tr key={r.ad_set_id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 text-left font-medium text-slate-900">
                  {r.campaign_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-left text-slate-900">
                  {r.ad_set_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">{fmtMoney(r.spend)}</td>
                <td className="px-4 py-3 text-right">{r.impressions.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{r.reach.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{fmtMoney(r.blended_cpm)}</td>
                <td className="px-4 py-3 text-right">{r.clicks.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{fmtPct(r.ctr_percent)}</td>
                <td className="px-4 py-3 text-right">{fmtMoney(r.cpc)}</td>
                <td className="px-4 py-3 text-right">{r.leads.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{fmtMaybeMoney(r.cost_per_lead)}</td>
                <td className="px-4 py-3 text-right">{fmtPct(r.lp_cvr_percent)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

