"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  costPer,
  rollupAdFunnel,
  type AdFunnelAdSetRow,
  type AdFunnelCampaignRow,
  type AdFunnelClassification,
  type AdFunnelCountKey,
  type AdFunnelMetrics
} from "@/lib/meta/adFunnelBreakdown";
import { formatCurrency, formatCurrencyNullable, formatInteger } from "@/lib/format";

type SortKey = "spend" | AdFunnelCountKey | `cost:${AdFunnelCountKey}`;

const METRICS: Array<{ key: AdFunnelCountKey; label: string; costLabel: string }> = [
  { key: "landingPageViews", label: "LP Visitors", costLabel: "Cost / LP Visitor" },
  { key: "optIns", label: "Website Opt-ins", costLabel: "Cost / Opt-in" },
  { key: "qualifiedOptIns", label: "Qualified Opt-ins", costLabel: "Cost / Qualified Opt-in" },
  { key: "callsBooked", label: "Calls Booked", costLabel: "Cost / Call Booked" },
  {
    key: "qualifiedCallsBooked",
    label: "Qualified Calls Booked",
    costLabel: "Cost / Qualified Call"
  },
  {
    key: "qualifiedShowups",
    label: "Qualified Showups",
    costLabel: "Cost / Qualified Showup"
  }
];

const CLASSIFICATION_LABEL: Record<Exclude<AdFunnelClassification, null>, string> = {
  landing_page: "Landing page",
  quickform: "Quickform",
  mixed: "Landing page + Quickform"
};

function sortValue(m: AdFunnelMetrics, key: SortKey): number | null {
  if (key === "spend") return m.spend;
  if (key.startsWith("cost:")) {
    return costPer(m.spend, m[key.slice(5) as AdFunnelCountKey]);
  }
  return m[key as AdFunnelCountKey];
}

function sortRows<T extends AdFunnelMetrics>(rows: T[], key: SortKey, dir: "asc" | "desc"): T[] {
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    // n/a rows always sink, regardless of direction.
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return dir === "asc" ? va - vb : vb - va;
  });
}

function matchesQuery(text: string | null | undefined, q: string): boolean {
  return !q || (text ?? "").toLowerCase().includes(q);
}

function Dash() {
  return <span className="text-slate-400">—</span>;
}

function MetricCells({ m }: { m: AdFunnelMetrics }) {
  return (
    <>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatCurrency(m.spend)}
      </td>
      {METRICS.map(({ key }) => {
        const count = m[key];
        const cost = costPer(m.spend, count);
        return (
          <Fragment key={key}>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
              {count === null ? <Dash /> : formatInteger(count)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
              {cost === null ? <Dash /> : formatCurrencyNullable(cost)}
            </td>
          </Fragment>
        );
      })}
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

function NameCell({
  name,
  level,
  classification,
  indent,
  open,
  onToggle
}: {
  name: string | null;
  level: string;
  classification: AdFunnelClassification;
  indent: string;
  open?: boolean;
  onToggle?: () => void;
}): ReactNode {
  const body = (
    <span className="min-w-0">
      <span className="block truncate text-slate-900" title={name ?? undefined}>
        {name ?? "—"}
      </span>
      <span className="text-[11px] text-slate-500">
        {level}
        {" · "}
        {classification ? CLASSIFICATION_LABEL[classification] : "Unclassified"}
      </span>
    </span>
  );
  return (
    <td className="max-w-[280px] px-4 py-3 text-left">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className={`flex w-full items-center gap-2 text-left ${indent}`}
          aria-expanded={open}
        >
          <Chevron open={Boolean(open)} />
          {body}
        </button>
      ) : (
        <div className={`flex items-center gap-2 ${indent}`}>{body}</div>
      )}
    </td>
  );
}

export default function MetaAdFunnelTable({ rows }: { rows: AdFunnelCampaignRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [openCampaigns, setOpenCampaigns] = useState<Set<string>>(new Set());
  const [openAdSets, setOpenAdSets] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const visible = useMemo(() => {
    const filtered = rows.filter(
      (c) =>
        matchesQuery(c.campaign_name, q) ||
        c.ad_sets.some(
          (s) => matchesQuery(s.ad_set_name, q) || s.ads.some((a) => matchesQuery(a.ad_name, q))
        )
    );
    return sortRows(filtered, sortKey, dir);
  }, [rows, q, sortKey, dir]);

  const totals = useMemo(
    () =>
      visible.length > 0
        ? rollupAdFunnel(visible, visible.reduce((s, c) => s + c.spend, 0))
        : null,
    [visible]
  );

  function toggle(set: typeof setOpenCampaigns, id: string) {
    set((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function header(key: SortKey, label: string) {
    const active = sortKey === key;
    return (
      <th
        key={key}
        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right"
        onClick={() => {
          if (active) setDir((d) => (d === "asc" ? "desc" : "asc"));
          else {
            setSortKey(key);
            setDir("desc");
          }
        }}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
        title="Click to sort"
      >
        <span className={active ? "font-medium text-blue-700" : ""}>{label}</span>
      </th>
    );
  }

  function visibleAdSets(campaign: AdFunnelCampaignRow): AdFunnelAdSetRow[] {
    const nameMatched = matchesQuery(campaign.campaign_name, q);
    return sortRows(
      campaign.ad_sets.filter(
        (s) =>
          nameMatched ||
          matchesQuery(s.ad_set_name, q) ||
          s.ads.some((a) => matchesQuery(a.ad_name, q))
      ),
      sortKey,
      dir
    );
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
        <table className="min-w-[1400px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-700">
              <th className="px-4 py-3 text-left">Name</th>
              {header("spend", "Adspend")}
              {METRICS.flatMap(({ key, label, costLabel }) => [
                header(key, label),
                header(`cost:${key}`, costLabel)
              ])}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={2 + METRICS.length * 2} className="px-4 py-10 text-center text-slate-500">
                  {searching ? "No matching campaigns, ad sets, or ads." : "No data in this date range."}
                </td>
              </tr>
            ) : (
              visible.map((campaign) => {
                const campaignOpen = searching || openCampaigns.has(campaign.campaign_id);
                const campaignNameMatched = matchesQuery(campaign.campaign_name, q);
                return (
                  <Fragment key={campaign.campaign_id}>
                    <tr className="hover:bg-slate-50/60">
                      <NameCell
                        name={campaign.campaign_name}
                        level="Campaign"
                        classification={campaign.classification}
                        indent=""
                        open={campaignOpen}
                        onToggle={() => toggle(setOpenCampaigns, campaign.campaign_id)}
                      />
                      <MetricCells m={campaign} />
                    </tr>
                    {campaignOpen &&
                      visibleAdSets(campaign).map((adSet) => {
                        const adSetOpen = searching || openAdSets.has(adSet.ad_set_id);
                        const adSetMatched =
                          campaignNameMatched || matchesQuery(adSet.ad_set_name, q);
                        const ads = sortRows(
                          adSet.ads.filter((a) => adSetMatched || matchesQuery(a.ad_name, q)),
                          sortKey,
                          dir
                        );
                        return (
                          <Fragment key={adSet.ad_set_id}>
                            <tr className="hover:bg-slate-50/60">
                              <NameCell
                                name={adSet.ad_set_name}
                                level="Ad set"
                                classification={adSet.classification}
                                indent="pl-5"
                                open={adSetOpen}
                                onToggle={() => toggle(setOpenAdSets, adSet.ad_set_id)}
                              />
                              <MetricCells m={adSet} />
                            </tr>
                            {adSetOpen &&
                              ads.map((ad) => (
                                <tr key={ad.ad_id} className="hover:bg-slate-50/60">
                                  <NameCell
                                    name={ad.ad_name}
                                    level="Ad"
                                    classification={ad.classification}
                                    indent="pl-10"
                                  />
                                  <MetricCells m={ad} />
                                </tr>
                              ))}
                          </Fragment>
                        );
                      })}
                  </Fragment>
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
