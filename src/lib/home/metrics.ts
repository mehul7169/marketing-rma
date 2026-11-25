import { periodDelta, type PeriodDelta } from "@/lib/home/delta";
import {
  bucketKey,
  iterateBucketKeys,
  type HomeTrafficId,
  type TrendBucket
} from "@/lib/home/range";
import {
  countKpi,
  HOME_DASHBOARD_FUNNEL,
  HOME_DASHBOARD_FUNNEL_LABELS,
  KPI_DEFINITIONS,
  leadHitsKpiInRange,
  trafficType,
  type KpiKey,
  type KpiLead,
  type TrafficLead,
  type TrafficType
} from "@/lib/leads/lifecycleDefinitions";
import type { LeadRow } from "@/lib/leads/types";
import { toISTDateString } from "@/lib/timezone";

export type HomeLead = KpiLead &
  TrafficLead &
  Pick<LeadRow, "id" | "owner_id" | "deal_value">;

export type HomeKpiCounts = Record<KpiKey, number>;

export type FunnelStep = {
  kpi: KpiKey;
  label: string;
  paid: number;
  organic: number;
  total: number;
  conversion: { pct: number; label: string } | null;
  href: string;
};

export type TrendPoint = {
  date: string;
  paid: number;
  organic: number;
  total: number;
};

export type CloserRow = {
  ownerId: string | null;
  label: string;
  showups: number;
  won: number;
  closeRate: number | null;
  revenue: number;
};

const ZERO: HomeKpiCounts = {
  leads: 0,
  contacted: 0,
  qualified: 0,
  calls_booked: 0,
  showups: 0,
  qualified_showups: 0,
  form_qualified_opt_ins: 0,
  deals_closed: 0
};

const FUNNEL_CONVERSION: Array<{
  from: KpiKey;
  to: KpiKey;
  word: string;
}> = [
  { from: "leads", to: "contacted", word: "contacted" },
  { from: "contacted", to: "calls_booked", word: "booked" },
  { from: "calls_booked", to: "showups", word: "showed" },
  { from: "showups", to: "deals_closed", word: "closed" }
];

export function matchesTraffic(
  lead: TrafficLead,
  traffic: HomeTrafficId
): boolean {
  if (traffic === "all") return true;
  return trafficType(lead) === traffic;
}

export function countKpis(
  leads: readonly KpiLead[],
  fromISO: string,
  toISO: string
): HomeKpiCounts {
  const out = { ...ZERO };
  for (const kpi of Object.keys(ZERO) as KpiKey[]) {
    out[kpi] = countKpi(leads, kpi, fromISO, toISO);
  }
  return out;
}

export function splitPaidOrganic(
  leads: readonly HomeLead[],
  kpi: KpiKey,
  fromISO: string,
  toISO: string
): { paid: number; organic: number } {
  let paid = 0;
  let organic = 0;
  for (const lead of leads) {
    if (!leadHitsKpiInRange(lead, kpi, fromISO, toISO)) continue;
    if (trafficType(lead) === "paid") paid += 1;
    else organic += 1;
  }
  return { paid, organic };
}

export function wonRevenue(
  leads: readonly HomeLead[],
  fromISO: string,
  toISO: string
): { revenue: number; won: number; unvalued: number } {
  let revenue = 0;
  let won = 0;
  let unvalued = 0;
  for (const lead of leads) {
    if (!leadHitsKpiInRange(lead, "deals_closed", fromISO, toISO)) continue;
    won += 1;
    const v = lead.deal_value;
    if (v == null) unvalued += 1;
    else revenue += v;
  }
  return { revenue, won, unvalued };
}

function conversionPct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 100);
}

export function buildFunnel(opts: {
  leads: readonly HomeLead[];
  fromISO: string;
  toISO: string;
  hrefFor: (kpi: KpiKey) => string;
}): FunnelStep[] {
  const { leads, fromISO, toISO, hrefFor } = opts;
  return HOME_DASHBOARD_FUNNEL.map((kpi) => {
    const split = splitPaidOrganic(leads, kpi, fromISO, toISO);
    const total = split.paid + split.organic;
    const step = FUNNEL_CONVERSION.find((c) => c.from === kpi);
    let conversion: FunnelStep["conversion"] = null;
    if (step) {
      const next = countKpi(leads, step.to, fromISO, toISO);
      conversion = {
        pct: conversionPct(next, total),
        label: `${conversionPct(next, total)}% ${step.word}`
      };
    }
    return {
      kpi,
      label: HOME_DASHBOARD_FUNNEL_LABELS[kpi],
      paid: split.paid,
      organic: split.organic,
      total,
      conversion,
      href: hrefFor(kpi)
    };
  });
}

export function buildTrend(opts: {
  leads: readonly HomeLead[];
  kpi: KpiKey;
  fromISO: string;
  toISO: string;
  bucket: TrendBucket;
  fillGaps?: boolean;
}): TrendPoint[] {
  const by = new Map<string, { paid: number; organic: number }>();
  const def = KPI_DEFINITIONS[opts.kpi];
  for (const lead of opts.leads) {
    if (!leadHitsKpiInRange(lead, opts.kpi, opts.fromISO, opts.toISO)) continue;
    const day = toISTDateString(lead[def.field] as string);
    const key = bucketKey(day, opts.bucket);
    const slot = by.get(key) ?? { paid: 0, organic: 0 };
    if (trafficType(lead) === "paid") slot.paid += 1;
    else slot.organic += 1;
    by.set(key, slot);
  }
  const keys =
    opts.fillGaps === false
      ? [...by.keys()].sort()
      : iterateBucketKeys(opts.fromISO, opts.toISO, opts.bucket);
  return keys.map((date) => {
    const slot = by.get(date) ?? { paid: 0, organic: 0 };
    return {
      date,
      paid: slot.paid,
      organic: slot.organic,
      total: slot.paid + slot.organic
    };
  });
}

export function buildClosers(
  leads: readonly HomeLead[],
  fromISO: string,
  toISO: string,
  labels: Map<string, string>
): CloserRow[] {
  const by = new Map<string, CloserRow>();
  function row(ownerId: string | null): CloserRow {
    const key = ownerId ?? "";
    const existing = by.get(key);
    if (existing) return existing;
    const next: CloserRow = {
      ownerId,
      label: ownerId ? (labels.get(ownerId) ?? ownerId) : "Unassigned",
      showups: 0,
      won: 0,
      closeRate: null,
      revenue: 0
    };
    by.set(key, next);
    return next;
  }
  for (const lead of leads) {
    const showed = leadHitsKpiInRange(lead, "showups", fromISO, toISO);
    const won = leadHitsKpiInRange(lead, "deals_closed", fromISO, toISO);
    if (!showed && !won) continue;
    const r = row(lead.owner_id);
    if (showed) r.showups += 1;
    if (won) {
      r.won += 1;
      r.revenue += lead.deal_value ?? 0;
    }
  }
  const out = [...by.values()];
  for (const r of out) {
    r.closeRate = r.showups > 0 ? r.won / r.showups : null;
  }
  out.sort((a, b) => b.won - a.won || b.showups - a.showups || a.label.localeCompare(b.label));
  return out;
}

export function paidShare(paid: number, total: number): string {
  if (total <= 0) return "0% paid";
  return `${Math.round((paid / total) * 100)}% paid`;
}

export function attachDeltas(
  current: HomeKpiCounts,
  prior: HomeKpiCounts,
  hide: boolean
): Partial<Record<KpiKey, PeriodDelta | null>> {
  if (hide) return {};
  const keys: KpiKey[] = ["leads", "calls_booked", "showups", "deals_closed"];
  const out: Partial<Record<KpiKey, PeriodDelta | null>> = {};
  for (const k of keys) out[k] = periodDelta(current[k], prior[k]);
  return out;
}

export function filterTraffic<T extends TrafficLead>(
  leads: readonly T[],
  traffic: HomeTrafficId
): T[] {
  if (traffic === "all") return [...leads];
  return leads.filter((l) => trafficType(l) === traffic);
}

export function trafficOf(lead: TrafficLead): TrafficType {
  return trafficType(lead);
}
