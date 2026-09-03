"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  MetaActionEntry,
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
import InfoTip from "@/components/InfoTip";
import { INSIGHTS_TOOLTIPS } from "@/lib/insights/tooltips";

export type ColumnPreset = "standard" | "rma";

const PRESET_STORAGE_KEY = "meta-ads-column-preset";

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
  | "cost_per_lead"
  | "results"
  | "cost_per_result"
  | "unique_outbound_clicks"
  | "unique_outbound_ctr"
  | "cost_per_unique_outbound_click"
  | "appointments_scheduled"
  | "cost_per_appointment_scheduled"
  | "formFilled"
  | "booked"
  | "showed"
  | "dealsClosed"
  | "dealValue";

type ColumnDef = {
  key: SortKey | "actions";
  label: string;
  sortable: boolean;
};

const FUNNEL_COLUMNS: ColumnDef[] = [
  { key: "formFilled", label: "Form Filled", sortable: true },
  { key: "booked", label: "Booked", sortable: true },
  { key: "showed", label: "Showed", sortable: true },
  { key: "dealsClosed", label: "Deals Closed", sortable: true },
  { key: "dealValue", label: "Deal Value", sortable: true }
];

const STANDARD_COLUMNS: ColumnDef[] = [
  ...FUNNEL_COLUMNS,
  { key: "spend", label: "Adspend", sortable: true },
  { key: "impressions", label: "Impr", sortable: true },
  { key: "reach", label: "Reach", sortable: true },
  { key: "blended_cpm", label: "CPM", sortable: true },
  { key: "clicks", label: "Clicks", sortable: true },
  { key: "ctr_percent", label: "CTR%", sortable: true },
  { key: "cpc", label: "CPC", sortable: true },
  { key: "leads", label: "Leads", sortable: true },
  { key: "cost_per_lead", label: "Lead Cost", sortable: true },
  { key: "lp_cvr_percent", label: "LP CVR%", sortable: true }
];

const RMA_COLUMNS: ColumnDef[] = [
  ...FUNNEL_COLUMNS,
  { key: "results", label: "Results", sortable: true },
  { key: "cost_per_result", label: "Cost / Result", sortable: true },
  { key: "actions", label: "Actions", sortable: false },
  { key: "spend", label: "Amount Spent", sortable: true },
  { key: "blended_cpm", label: "CPM", sortable: true },
  { key: "impressions", label: "Impressions", sortable: true },
  { key: "reach", label: "Reach", sortable: true },
  { key: "unique_outbound_clicks", label: "Unique Outbound Clicks", sortable: true },
  { key: "unique_outbound_ctr", label: "Unique Outbound CTR", sortable: true },
  {
    key: "cost_per_unique_outbound_click",
    label: "Cost / Unique Outbound Click",
    sortable: true
  },
  { key: "leads", label: "Leads", sortable: true },
  { key: "cost_per_lead", label: "Cost per Lead", sortable: true },
  { key: "appointments_scheduled", label: "Appointments Scheduled", sortable: true },
  {
    key: "cost_per_appointment_scheduled",
    label: "Cost / Appointment Scheduled",
    sortable: true
  }
];

function columnsForPreset(preset: ColumnPreset): ColumnDef[] {
  return preset === "rma" ? RMA_COLUMNS : STANDARD_COLUMNS;
}

function defaultSortKey(preset: ColumnPreset): SortKey {
  return "spend";
}

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

function mergeActionMaps(maps: MetaActionEntry[][]): MetaActionEntry[] {
  const acc = new Map<string, number>();
  for (const list of maps) {
    for (const a of list) {
      const n = Number(a.value);
      if (!Number.isFinite(n)) continue;
      acc.set(a.action_type, (acc.get(a.action_type) ?? 0) + n);
    }
  }
  return Array.from(acc.entries())
    .map(([action_type, value]) => ({ action_type, value: String(value) }))
    .sort((a, b) => a.action_type.localeCompare(b.action_type));
}

function computeTotals(campaigns: MetaCampaignNode[]): MetaAdsMetrics | null {
  if (campaigns.length === 0) return null;
  const spend = campaigns.reduce((s, r) => s + r.spend, 0);
  const impressions = campaigns.reduce((s, r) => s + r.impressions, 0);
  const reach = campaigns.reduce((s, r) => s + r.reach, 0);
  const clicks = campaigns.reduce((s, r) => s + r.clicks, 0);
  const leads = campaigns.reduce((s, r) => s + r.leads, 0);
  const results = campaigns.reduce((s, r) => s + r.results, 0);
  const unique_outbound_clicks = campaigns.reduce(
    (s, r) => s + r.unique_outbound_clicks,
    0
  );
  const appointments_scheduled = campaigns.reduce(
    (s, r) => s + r.appointments_scheduled,
    0
  );
  const formFilled = campaigns.reduce((s, r) => s + r.formFilled, 0);
  const booked = campaigns.reduce((s, r) => s + r.booked, 0);
  const showed = campaigns.reduce((s, r) => s + r.showed, 0);
  const dealsClosed = campaigns.reduce((s, r) => s + r.dealsClosed, 0);
  const dealValue = campaigns.reduce((s, r) => s + r.dealValue, 0);
  const actions = mergeActionMaps(campaigns.map((c) => c.actions));

  return {
    spend,
    impressions,
    reach,
    clicks,
    leads,
    results,
    unique_outbound_clicks,
    appointments_scheduled,
    actions,
    formFilled,
    booked,
    showed,
    dealsClosed,
    dealValue,
    blended_cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    ctr_percent: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    lp_cvr_percent: clicks > 0 ? (leads / clicks) * 100 : 0,
    cost_per_lead: leads > 0 ? spend / leads : null,
    cost_per_result: results > 0 ? spend / results : null,
    unique_outbound_ctr:
      reach > 0 ? (unique_outbound_clicks / reach) * 100 : 0,
    cost_per_unique_outbound_click:
      unique_outbound_clicks > 0 ? spend / unique_outbound_clicks : null,
    cost_per_appointment_scheduled:
      appointments_scheduled > 0 ? spend / appointments_scheduled : null
  };
}

function formatCell(key: SortKey | "actions", m: MetaAdsMetrics): ReactNode {
  if (key === "actions") {
    return <ActionsSummary actions={m.actions} />;
  }
  switch (key) {
    case "spend":
    case "blended_cpm":
    case "cpc":
    case "dealValue":
      return formatCurrency(m[key]);
    case "cost_per_lead":
    case "cost_per_result":
    case "cost_per_unique_outbound_click":
    case "cost_per_appointment_scheduled":
      return formatCurrencyNullable(m[key]);
    case "ctr_percent":
    case "lp_cvr_percent":
    case "unique_outbound_ctr":
      return formatPercent(m[key]);
    case "impressions":
    case "reach":
    case "clicks":
    case "leads":
    case "results":
    case "unique_outbound_clicks":
    case "appointments_scheduled":
    case "formFilled":
    case "booked":
    case "showed":
    case "dealsClosed":
      return formatInteger(m[key]);
    default:
      return "—";
  }
}

function ActionsSummary({ actions }: { actions: MetaActionEntry[] }) {
  const [open, setOpen] = useState(false);
  const count = actions.length;

  if (count === 0) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        className="text-xs text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => {
          // Delay so a click inside the panel can register first.
          window.setTimeout(() => setOpen(false), 150);
        }}
        aria-expanded={open}
      >
        {count} action type{count === 1 ? "" : "s"}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 max-h-56 w-64 overflow-y-auto rounded border border-slate-200 bg-white px-3 py-2 text-left shadow-sm">
          <ul className="space-y-1">
            {actions.map((a) => (
              <li
                key={a.action_type}
                className="flex justify-between gap-3 text-[11px] text-slate-700"
              >
                <span className="min-w-0 break-all">{a.action_type}</span>
                <span className="shrink-0 tabular-nums text-slate-900">
                  {formatInteger(Number(a.value) || 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MetricCells({
  m,
  columns
}: {
  m: MetaAdsMetrics;
  columns: ColumnDef[];
}) {
  return (
    <>
      {columns.map((col) => (
        <td
          key={col.key}
          className="whitespace-nowrap px-4 py-3 text-right tabular-nums"
        >
          {formatCell(col.key, m)}
        </td>
      ))}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span className="inline-block w-3 shrink-0 text-slate-400" aria-hidden>
      {open ? "▾" : "▸"}
    </span>
  );
}

function readStoredPreset(): ColumnPreset {
  if (typeof window === "undefined") return "standard";
  try {
    const v = window.localStorage.getItem(PRESET_STORAGE_KEY);
    if (v === "rma" || v === "standard") return v;
  } catch {
    // ignore
  }
  return "standard";
}

export default function MetaAdsTable({
  rows,
  unmatchedLeadCount = 0
}: {
  rows: MetaCampaignNode[];
  unmatchedLeadCount?: number;
}) {
  const [preset, setPreset] = useState<ColumnPreset>("standard");
  const [hydrated, setHydrated] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [openCampaigns, setOpenCampaigns] = useState<Set<string>>(new Set());
  const [openAdSets, setOpenAdSets] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPreset(readStoredPreset());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(PRESET_STORAGE_KEY, preset);
    } catch {
      // ignore
    }
  }, [preset, hydrated]);

  const columns = columnsForPreset(preset);

  useEffect(() => {
    const cols = columnsForPreset(preset);
    const allowed = new Set(
      cols.filter((c) => c.sortable).map((c) => c.key as SortKey)
    );
    if (!allowed.has(sortKey)) {
      setSortKey(defaultSortKey(preset));
      setDir("desc");
    }
  }, [preset, sortKey]);

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
      <div className="flex flex-wrap items-end gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search campaign, ad set, or ad name"
          className="w-full max-w-md rounded border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
        />
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Columns
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as ColumnPreset)}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="standard">Standard</option>
            <option value="rma">RMA Performance Tracking</option>
          </select>
        </label>
      </div>

      <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span>Unmatched leads: {formatInteger(unmatchedLeadCount)}</span>
        <InfoTip text={INSIGHTS_TOOLTIPS.creativeUnmatched} />
        <span className="text-slate-400">
          (utm_content vs Meta ad name — not an ID match)
        </span>
      </p>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-[1200px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-700">
              <th className="px-4 py-3 text-left">Name</th>
              {columns.map((col) => {
                const isActive = col.sortable && sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-4 py-3 text-right ${
                      col.sortable ? "cursor-pointer select-none" : ""
                    }`}
                    onClick={() => {
                      if (!col.sortable) return;
                      const key = col.key as SortKey;
                      if (sortKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
                      else {
                        setSortKey(key);
                        setDir("desc");
                      }
                    }}
                    aria-sort={
                      isActive ? (dir === "asc" ? "ascending" : "descending") : "none"
                    }
                    title={col.sortable ? "Click to sort" : undefined}
                  >
                    <span className={isActive ? "font-medium text-blue-700" : ""}>
                      {col.label}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sortedCampaigns.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  {searching
                    ? "No matching campaigns, ad sets, or ads."
                    : "No data in this date range."}
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
                    columns={columns}
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
                <MetricCells m={totals} columns={columns} />
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
  columns,
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
  columns: ColumnDef[];
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
              <span
                className="block truncate font-medium text-slate-900"
                title={campaign.campaign_name ?? undefined}
              >
                {campaign.campaign_name ?? "—"}
              </span>
              <span className="text-[11px] text-slate-500">Campaign</span>
            </span>
          </button>
        </td>
        <MetricCells m={campaign} columns={columns} />
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
              columns={columns}
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
  columns,
  onToggle
}: {
  adSet: MetaAdSetNode;
  ads: MetaAdNode[];
  open: boolean;
  columns: ColumnDef[];
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
              <span
                className="block truncate text-slate-900"
                title={adSet.ad_set_name ?? undefined}
              >
                {adSet.ad_set_name ?? "—"}
              </span>
              <span className="text-[11px] text-slate-500">Ad set</span>
            </span>
          </button>
        </td>
        <MetricCells m={adSet} columns={columns} />
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
                  <span
                    className="block truncate text-slate-900"
                    title={ad.ad_name ?? undefined}
                  >
                    {ad.ad_name ?? "—"}
                  </span>
                  <span className="text-[11px] text-slate-500">Ad</span>
                </span>
              </div>
            </td>
            <MetricCells m={ad} columns={columns} />
          </tr>
        ))}
    </>
  );
}
