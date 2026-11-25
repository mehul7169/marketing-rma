import { dealHref } from "@/lib/deals/dealListParams";
import { formatInrCompact } from "@/lib/format";
import type { PeriodDelta } from "@/lib/home/delta";
import {
  attachDeltas,
  buildClosers,
  buildFunnel,
  buildTrend,
  countKpis,
  filterTraffic,
  paidShare,
  splitPaidOrganic,
  wonRevenue,
  type CloserRow,
  type FunnelStep,
  type HomeKpiCounts,
  type HomeLead,
  type TrendPoint
} from "@/lib/home/metrics";
import { revenuePace, type RevenuePace } from "@/lib/home/pace";
import {
  parseHomeRange,
  parseHomeTraffic,
  rangeToFromTo,
  trendBucketFor,
  type HomeRangeId,
  type HomeTrafficId,
  type TrendBucket
} from "@/lib/home/range";
import type { MonthlyTarget } from "@/lib/db/organizations";
import type { SetterActivityUser } from "@/lib/insights/setterActivity";
import type { CustomFilter } from "@/lib/leads/customFilter";
import { kpiLeadsHref } from "@/lib/leads/listFilterParams";
import type { KpiKey } from "@/lib/leads/lifecycleDefinitions";
import { formatCalendarDate } from "@/lib/timezone";
import { getPriorPeriod } from "@/lib/utils/date";

export const TREND_KPIS = [
  "calls_booked",
  "leads",
  "showups",
  "deals_closed"
] as const;
export type HomeTrendKpi = (typeof TREND_KPIS)[number];

export const TREND_KPI_OPTIONS: Array<{ value: HomeTrendKpi; label: string }> = [
  { value: "calls_booked", label: "Calls booked" },
  { value: "leads", label: "Leads" },
  { value: "showups", label: "Showups" },
  { value: "deals_closed", label: "Won" }
];

export type HomeKpiTile = {
  key: "leads" | "calls_booked" | "showups" | "deals_closed";
  label: string;
  value: number;
  sub: string;
  delta: PeriodDelta | null;
};

export type SetterBoardRow = {
  userId: string | null;
  label: string;
  dials: number;
  booked: number;
  bookingRate: number | null;
  rank: number;
};

export type HomeAds =
  | { kind: "spend"; spend: number; costPerBooked: number | null }
  | { kind: "stale"; since: string };

export type HomeGoal = {
  revenue: number;
  won: number;
  unvalued: number;
  target: number;
  pace: RevenuePace;
  monthLabel: string;
  wonHref: string;
  unvaluedHref: string;
};

export type HomeDashboard = {
  range: HomeRangeId;
  traffic: HomeTrafficId;
  fromISO: string;
  toISO: string;
  todayISO: string;
  goal: HomeGoal | null;
  kpis: HomeKpiTile[];
  funnel: FunnelStep[];
  qualified: { count: number; ofContacted: string };
  trends: Record<HomeTrendKpi, TrendPoint[]>;
  trendBucket: TrendBucket;
  setters: SetterBoardRow[];
  closers: Array<CloserRow & { rank: number }>;
  ads: HomeAds | null;
};

export function trafficCustomFilter(
  traffic: HomeTrafficId
): CustomFilter | null {
  if (traffic === "all") return null;
  return {
    match: "all",
    conditions: [
      { id: "traffic", field: "traffic", op: "is_any", value: [traffic] }
    ]
  };
}

function unvaluedWonFilter(): CustomFilter {
  return {
    match: "all",
    conditions: [{ id: "unvalued", field: "deal_value", op: "is_empty" }]
  };
}

function kpiSub(
  key: HomeKpiTile["key"],
  counts: HomeKpiCounts,
  paidLeads: number,
  wonValue: number
): string {
  if (key === "leads") return paidShare(paidLeads, counts.leads);
  if (key === "calls_booked") {
    const pct =
      counts.leads <= 0
        ? 0
        : Math.round((counts.calls_booked / counts.leads) * 100);
    return `${pct}% of leads`;
  }
  if (key === "showups") {
    const pct =
      counts.calls_booked <= 0
        ? 0
        : Math.round((counts.showups / counts.calls_booked) * 100);
    return `${pct}% show rate`;
  }
  return formatInrCompact(wonValue);
}

export function assembleHomeDashboard(opts: {
  leads: readonly HomeLead[];
  range: HomeRangeId;
  traffic: HomeTrafficId;
  todayISO: string;
  monthStart: string;
  monthEnd: string;
  monthlyTarget: MonthlyTarget | null;
  setters: readonly SetterActivityUser[];
  closerLabels: Map<string, string>;
  ads: {
    spend: number;
    stale: boolean;
    lastDataDate: string | null;
  } | null;
}): HomeDashboard {
  const {
    range,
    traffic,
    todayISO,
    monthStart,
    monthEnd,
    monthlyTarget,
    closerLabels
  } = opts;
  const { fromISO, toISO } = rangeToFromTo(range, todayISO);
  const scoped = filterTraffic(opts.leads, traffic);
  const counts = countKpis(scoped, fromISO, toISO);
  const prior =
    range === "all" ? null : getPriorPeriod(fromISO, toISO);
  const priorCounts = prior
    ? countKpis(filterTraffic(opts.leads, traffic), prior.fromISO, prior.toISO)
    : counts;
  const deltas = attachDeltas(counts, priorCounts, range === "all");
  const paidLeads = splitPaidOrganic(scoped, "leads", fromISO, toISO).paid;
  const rangeWon = wonRevenue(scoped, fromISO, toISO);
  const cf = trafficCustomFilter(traffic);
  const rangeObj = { fromISO, toISO };

  const hrefFor = (kpi: KpiKey) =>
    kpi === "deals_closed"
      ? dealHref({
          tab: "won",
          from: fromISO,
          to: toISO,
          customFilter: cf
        })
      : kpiLeadsHref(kpi, rangeObj, { customFilter: cf });

  const funnel = buildFunnel({
    leads: scoped,
    fromISO,
    toISO,
    hrefFor
  });

  const contacted = counts.contacted;
  const qualifiedPct =
    contacted <= 0 ? 0 : Math.round((counts.qualified / contacted) * 100);

  const bucket = trendBucketFor(range, fromISO, toISO);
  const trends = {
    calls_booked: buildTrend({
      leads: scoped,
      kpi: "calls_booked",
      fromISO,
      toISO,
      bucket
    }),
    leads: buildTrend({
      leads: scoped,
      kpi: "leads",
      fromISO,
      toISO,
      bucket
    }),
    showups: buildTrend({
      leads: scoped,
      kpi: "showups",
      fromISO,
      toISO,
      bucket
    }),
    deals_closed: buildTrend({
      leads: scoped,
      kpi: "deals_closed",
      fromISO,
      toISO,
      bucket
    })
  };

  const kpis: HomeKpiTile[] = [
    {
      key: "leads",
      label: "Leads",
      value: counts.leads,
      sub: kpiSub("leads", counts, paidLeads, rangeWon.revenue),
      delta: deltas.leads ?? null
    },
    {
      key: "calls_booked",
      label: "Calls booked",
      value: counts.calls_booked,
      sub: kpiSub("calls_booked", counts, paidLeads, rangeWon.revenue),
      delta: deltas.calls_booked ?? null
    },
    {
      key: "showups",
      label: "Showups",
      value: counts.showups,
      sub: kpiSub("showups", counts, paidLeads, rangeWon.revenue),
      delta: deltas.showups ?? null
    },
    {
      key: "deals_closed",
      label: "Won",
      value: counts.deals_closed,
      sub: kpiSub("deals_closed", counts, paidLeads, rangeWon.revenue),
      delta: deltas.deals_closed ?? null
    }
  ];

  const monthWon = wonRevenue(opts.leads, monthStart, monthEnd);
  const goal: HomeGoal | null = monthlyTarget
    ? {
        revenue: monthWon.revenue,
        won: monthWon.won,
        unvalued: monthWon.unvalued,
        target: monthlyTarget.value,
        pace: revenuePace({
          revenue: monthWon.revenue,
          goal: monthlyTarget.value,
          todayISO,
          monthStart,
          monthEnd
        }),
        monthLabel: `${formatCalendarDate(monthStart, "MMMM")} revenue`,
        wonHref: dealHref({ tab: "won", from: monthStart, to: monthEnd }),
        unvaluedHref: dealHref({
          tab: "won",
          from: monthStart,
          to: monthEnd,
          customFilter: unvaluedWonFilter()
        })
      }
    : null;

  const setters: SetterBoardRow[] = [...opts.setters]
    .sort(
      (a, b) =>
        b.callsBooked - a.callsBooked ||
        b.dials - a.dials ||
        a.label.localeCompare(b.label)
    )
    .map((u, i) => ({
      userId: u.userId,
      label: u.label,
      dials: u.dials,
      booked: u.callsBooked,
      bookingRate: u.dials > 0 ? u.callsBooked / u.dials : null,
      rank: i + 1
    }));

  const closers = buildClosers(scoped, fromISO, toISO, closerLabels).map(
    (row, i) => ({ ...row, rank: i + 1 })
  );

  let ads: HomeAds | null = null;
  if (opts.ads?.stale) {
    ads = {
      kind: "stale",
      since: opts.ads.lastDataDate
        ? formatCalendarDate(opts.ads.lastDataDate, "d MMM")
        : "unknown"
    };
  } else if (opts.ads && traffic !== "organic") {
    ads = {
      kind: "spend",
      spend: opts.ads.spend,
      costPerBooked:
        counts.calls_booked > 0 ? opts.ads.spend / counts.calls_booked : null
    };
  }

  return {
    range: parseHomeRange(range),
    traffic: parseHomeTraffic(traffic),
    fromISO,
    toISO,
    todayISO,
    goal,
    kpis,
    funnel,
    qualified: {
      count: counts.qualified,
      ofContacted: `${counts.qualified} qualified · ${qualifiedPct}% of contacted`
    },
    trends,
    trendBucket: bucket,
    setters,
    closers,
    ads
  };
}
