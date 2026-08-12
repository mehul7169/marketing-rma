"use client";

import { useMemo, useState } from "react";
import type { MetaAdsTableRow } from "@/lib/db/meta_ads_daily";
import {
  formatCurrency,
  formatCurrencyNullable,
  formatInteger,
  formatPercent
} from "@/lib/format";

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

function computeTotals(rows: MetaAdsTableRow[]): MetaAdsTableRow | null {
  if (rows.length === 0) return null;

  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const reach = rows.reduce((s, r) => s + r.reach, 0);
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const leads = rows.reduce((s, r) => s + r.leads, 0);

  return {
    ad_set_id: "__totals__",
    ad_set_name: null,
    campaign_id: null,
    campaign_name: null,
    spend,
    impressions,
    reach,
    clicks,
    leads,
    blended_cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    ctr_percent: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    lp_cvr_percent: clicks > 0 ? (leads / clicks) * 100 : 0,
    cost_per_lead: leads > 0 ? spend / leads : null
  };
}

function TruncatedText({
  text,
  className = ""
}: {
  text: string | null;
  className?: string;
}) {
  if (!text) return <span className={className}>—</span>;
  return (
    <span className={`block truncate ${className}`} title={text}>
      {text}
    </span>
  );
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

  const totals = useMemo(() => computeTotals(rows), [rows]);

  const numericColumns: Array<[SortKey, string]> = [
    ["spend", "Adspend"],
    ["impressions", "Impr"],
    ["reach", "Reach"],
    ["blended_cpm", "CPM"],
    ["clicks", "Clicks"],
    ["ctr_percent", "CTR%"],
    ["cpc", "CPC"],
    ["leads", "Leads"],
    ["cost_per_lead", "Lead Cost"],
    ["lp_cvr_percent", "LP CVR%"]
  ];

  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="min-w-[900px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-700">
            <th className="max-w-[180px] px-4 py-3 text-left">Campaign</th>
            <th className="max-w-[160px] px-4 py-3 text-left">Ad Set</th>
            {numericColumns.map(([key, label]) => {
              const isActive = sortKey === key;
              return (
                <th
                  key={key}
                  className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right"
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
                  <span className={isActive ? "font-medium text-blue-700" : ""}>
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
                <td className="max-w-[180px] px-4 py-3 text-left">
                  <TruncatedText
                    text={r.campaign_name}
                    className="font-medium text-slate-900"
                  />
                </td>
                <td className="max-w-[160px] px-4 py-3 text-left">
                  <TruncatedText text={r.ad_set_name} className="text-slate-900" />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatCurrency(r.spend)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatInteger(r.impressions)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatInteger(r.reach)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatCurrency(r.blended_cpm)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatInteger(r.clicks)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatPercent(r.ctr_percent)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatCurrency(r.cpc)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatInteger(r.leads)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatCurrencyNullable(r.cost_per_lead)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatPercent(r.lp_cvr_percent)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-medium text-slate-900">
              <td className="px-4 py-3 text-left" colSpan={2}>
                Total
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatCurrency(totals.spend)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatInteger(totals.impressions)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatInteger(totals.reach)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatCurrency(totals.blended_cpm)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatInteger(totals.clicks)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatPercent(totals.ctr_percent)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatCurrency(totals.cpc)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatInteger(totals.leads)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatCurrencyNullable(totals.cost_per_lead)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {formatPercent(totals.lp_cvr_percent)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
