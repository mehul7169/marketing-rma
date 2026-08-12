"use client";

import { useMemo, useState } from "react";
import type {
  MetaAdNode,
  MetaAdSetNode,
  MetaAdsMetrics,
  MetaCampaignNode
} from "@/lib/db/meta_ads_daily";
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

const NUMERIC_COLUMNS: Array<[SortKey, string]> = [
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

function sortByKey<T extends MetaAdsMetrics>(
  rows: T[],
  key: SortKey,
  dir: "asc" | "desc"
): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const va = a[key] as number | null;
    const vb = b[key] as number | null;
    const na = va === null ? -Infinity : va;
    const nb = vb === null ? -Infinity : vb;
    return dir === "asc" ? na - nb : nb - na;
  });
  return copy;
}

function matchesQuery(text: string | null | undefined, q: string): boolean {
  if (!q) return true;
  return (text ?? "").toLowerCase().includes(q);
}

function campaignMatches(campaign: MetaCampaignNode, q: string): boolean {
  if (!q) return true;
  if (matchesQuery(campaign.campaign_name, q)) return true;
  return campaign.ad_sets.some(
    (adSet) =>
      matchesQuery(adSet.ad_set_name, q) ||
      adSet.ads.some((ad) => matchesQuery(ad.ad_name, q))
  );
}

function adSetMatches(adSet: MetaAdSetNode, q: string, campaignMatched: boolean): boolean {
  if (!q || campaignMatched) return true;
  if (matchesQuery(adSet.ad_set_name, q)) return true;
  return adSet.ads.some((ad) => matchesQuery(ad.ad_name, q));
}

function adMatches(ad: MetaAdNode, q: string, ancestorMatched: boolean): boolean {
  if (!q || ancestorMatched) return true;
  return matchesQuery(ad.ad_name, q);
}

function computeTotals(campaigns: MetaCampaignNode[]): MetaAdsMetrics | null {
  if (campaigns.length === 0) return null;
  const spend = campaigns.reduce((s, r) => s + r.spend, 0);
  const impressions = campaigns.reduce((s, r) => s + r.impressions, 0);
  const reach = campaigns.reduce((s, r) => s + r.reach, 0);
  const clicks = campaigns.reduce((s, r) => s + r.clicks, 0);
  const leads = campaigns.reduce((s, r) => s + r.leads, 0);
  return {
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

function MetricCells({ m }: { m: MetaAdsMetrics }) {
  return (
    <>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatCurrency(m.spend)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatInteger(m.impressions)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatInteger(m.reach)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatCurrency(m.blended_cpm)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatInteger(m.clicks)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatPercent(m.ctr_percent)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatCurrency(m.cpc)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatInteger(m.leads)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatCurrencyNullable(m.cost_per_lead)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatPercent(m.lp_cvr_percent)}
      </td>
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className="inline-block w-3 shrink-0 text-slate-400"
      aria-hidden
    >
      {open ? "▾" : "▸"}
    </span>
  );
}

export default function MetaAdsTable({ rows }: { rows: MetaCampaignNode[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [openCampaigns, setOpenCampaigns] = useState<Set<string>>(new Set());
  const [openAdSets, setOpenAdSets] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const filtered = useMemo(
    () => rows.filter((c) => campaignMatches(c, q)),
    [rows, q]
  );

  const sortedCampaigns = useMemo(
    () => sortByKey(filtered, sortKey, dir),
    [filtered, sortKey, dir]
  );

  const totals = useMemo(() => computeTotals(filtered), [filtered]);

  function isCampaignOpen(id: string) {
    return searching || openCampaigns.has(id);
  }

  function isAdSetOpen(id: string) {
    return searching || openAdSets.has(id);
  }

  function toggleCampaign(id: string) {
    setOpenCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAdSet(id: string) {
    setOpenAdSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search campaign, ad set, or ad name"
        className="w-full max-w-md rounded border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
      />

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-[960px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-700">
              <th className="px-4 py-3 text-left">Name</th>
              {NUMERIC_COLUMNS.map(([key, label]) => {
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
            {sortedCampaigns.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                  {searching ? "No matching campaigns, ad sets, or ads." : "No data in this date range."}
                </td>
              </tr>
            ) : (
              sortedCampaigns.map((campaign) => {
                const campaignOpen = isCampaignOpen(campaign.campaign_id);
                const campaignNameMatched = matchesQuery(campaign.campaign_name, q);
                const visibleAdSets = sortByKey(
                  campaign.ad_sets.filter((adSet) =>
                    adSetMatches(adSet, q, campaignNameMatched)
                  ),
                  sortKey,
                  dir
                );

                return (
                  <CampaignBlock
                    key={campaign.campaign_id}
                    campaign={campaign}
                    adSets={visibleAdSets}
                    open={campaignOpen}
                    query={q}
                    campaignNameMatched={campaignNameMatched}
                    sortKey={sortKey}
                    dir={dir}
                    isAdSetOpen={isAdSetOpen}
                    onToggleCampaign={() => toggleCampaign(campaign.campaign_id)}
                    onToggleAdSet={toggleAdSet}
                  />
                );
              })
            )}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-medium text-slate-900">
                <td className="px-4 py-3 text-left">Total</td>
                <MetricCells m={totals} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function CampaignBlock({
  campaign,
  adSets,
  open,
  query,
  campaignNameMatched,
  sortKey,
  dir,
  isAdSetOpen,
  onToggleCampaign,
  onToggleAdSet
}: {
  campaign: MetaCampaignNode;
  adSets: MetaAdSetNode[];
  open: boolean;
  query: string;
  campaignNameMatched: boolean;
  sortKey: SortKey;
  dir: "asc" | "desc";
  isAdSetOpen: (id: string) => boolean;
  onToggleCampaign: () => void;
  onToggleAdSet: (id: string) => void;
}) {
  return (
    <>
      <tr className="hover:bg-slate-50/60">
        <td className="max-w-[280px] px-4 py-3 text-left">
          <button
            type="button"
            onClick={onToggleCampaign}
            className="flex w-full items-center gap-2 text-left"
            aria-expanded={open}
          >
            <Chevron open={open} />
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-900" title={campaign.campaign_name ?? undefined}>
                {campaign.campaign_name ?? "—"}
              </span>
              <span className="text-[11px] text-slate-500">Campaign</span>
            </span>
          </button>
        </td>
        <MetricCells m={campaign} />
      </tr>
      {open &&
        adSets.map((adSet) => {
          const adSetOpen = isAdSetOpen(adSet.ad_set_id);
          const adSetNameMatched =
            campaignNameMatched || matchesQuery(adSet.ad_set_name, query);
          const visibleAds = sortByKey(
            adSet.ads.filter((ad) => adMatches(ad, query, adSetNameMatched)),
            sortKey,
            dir
          );

          return (
            <AdSetBlock
              key={adSet.ad_set_id}
              adSet={adSet}
              ads={visibleAds}
              open={adSetOpen}
              onToggle={() => onToggleAdSet(adSet.ad_set_id)}
            />
          );
        })}
    </>
  );
}

function AdSetBlock({
  adSet,
  ads,
  open,
  onToggle
}: {
  adSet: MetaAdSetNode;
  ads: MetaAdNode[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-slate-50/60">
        <td className="max-w-[280px] px-4 py-3 text-left">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-2 pl-5 text-left"
            aria-expanded={open}
          >
            <Chevron open={open} />
            <span className="min-w-0">
              <span className="block truncate text-slate-900" title={adSet.ad_set_name ?? undefined}>
                {adSet.ad_set_name ?? "—"}
              </span>
              <span className="text-[11px] text-slate-500">Ad set</span>
            </span>
          </button>
        </td>
        <MetricCells m={adSet} />
      </tr>
      {open &&
        ads.map((ad) => (
          <tr key={ad.ad_id} className="hover:bg-slate-50/60">
            <td className="max-w-[280px] px-4 py-3 text-left">
              <div className="flex items-center gap-2 pl-10">
                {ad.creative_thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ad.creative_thumbnail_url}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-cover"
                  />
                ) : null}
                <span className="min-w-0">
                  <span className="block truncate text-slate-900" title={ad.ad_name ?? undefined}>
                    {ad.ad_name ?? "—"}
                  </span>
                  <span className="text-[11px] text-slate-500">Ad</span>
                </span>
              </div>
            </td>
            <MetricCells m={ad} />
          </tr>
        ))}
    </>
  );
}
