import type { LeadRow } from "@/lib/leads/types";
import { addDaysISO } from "@/lib/utils/date";
import { toISTDateString } from "@/lib/timezone";

export type RateStat = {
  numerator: number;
  denominator: number;
  /** Percentage 0–100, or null when the denominator is 0. */
  rate: number | null;
};

export type CreativeRow = {
  key: string;
  name: string;
  unmatched: boolean;
  spend: number;
  callsBooked: number;
  qualified: number;
  showed: number;
  dealsClosed: number;
  revenue: number;
  costPerBooked: number | null;
  costPerDeal: number | null;
};

export type SourceBookedRow = {
  source: string;
  callsBooked: number;
};

export type InsightsDailyPoint = {
  date: string;
  callsBooked: number;
  showUpCalls: number;
  dealsClosed: number;
};

export type InsightsMetrics = {
  formQualified: RateStat;
  setterVerified: RateStat;
  showUp: RateStat;
  closure: RateStat;
  creatives: CreativeRow[];
  unmatchedLeadCount: number;
  sourceBooked: SourceBookedRow[];
  daily: InsightsDailyPoint[];
};

/**
 * Rates + creative/source outcome columns: cohort-based.
 * Cohort = created_at in the selected range; stage counts are "ever reached"
 * via raw boolean/timestamp fields (any time).
 *
 * Spend stays period-based (money spent in the range).
 * Daily trend stays event-based (bucketed by event timestamp in range).
 *
 * Creative "Qualified" = setter_verified (column label historical meaning).
 */
function datePart(iso: string): string {
  return toISTDateString(iso);
}

function inRange(iso: string | null, fromISO: string, toISO: string): boolean {
  if (!iso) return false;
  const d = datePart(iso);
  return d >= fromISO && d <= toISO;
}

function rate(numerator: number, denominator: number): RateStat {
  return {
    numerator,
    denominator,
    rate: denominator > 0 ? (numerator / denominator) * 100 : null
  };
}

/**
 * Creative key for name-based fallback (utm_content ↔ ad_name).
 * Prefer resolveCreativeMatch (ad_id first) for attribution.
 */
export function normalizeCreativeKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const t = name.trim().toLowerCase();
  return t.length ? t : null;
}

export type KnownAdRef = {
  adId: string;
  adName: string;
};

export type KnownAdsIndex = {
  /** Meta ad_id → display name */
  byAdId: Map<string, string>;
  /** normalizeCreativeKey(ad_name) → { adId, adName } */
  byAdName: Map<string, KnownAdRef>;
};

export type CreativeMatch = KnownAdRef & {
  matchedBy: "ad_id" | "ad_name";
};

/**
 * Match lead utm_content to a Meta ad: try stable ad_id first, then ad_name.
 */
export function resolveCreativeMatch(
  utmContent: string | null | undefined,
  known: KnownAdsIndex
): CreativeMatch | null {
  const raw = utmContent?.trim();
  if (!raw) return null;

  if (known.byAdId.has(raw)) {
    return {
      adId: raw,
      adName: known.byAdId.get(raw)!,
      matchedBy: "ad_id"
    };
  }

  const nameKey = normalizeCreativeKey(raw);
  if (nameKey && known.byAdName.has(nameKey)) {
    const ref = known.byAdName.get(nameKey)!;
    return { ...ref, matchedBy: "ad_name" };
  }

  return null;
}

function cost(spend: number, count: number): number | null {
  if (count <= 0) return null;
  return spend / count;
}

function emptyDaily(fromISO: string, toISO: string): InsightsDailyPoint[] {
  const points: InsightsDailyPoint[] = [];
  let cursor = fromISO;
  while (cursor <= toISO) {
    points.push({
      date: cursor,
      callsBooked: 0,
      showUpCalls: 0,
      dealsClosed: 0
    });
    cursor = addDaysISO(cursor, 1);
  }
  return points;
}

export function computeInsights(
  leads: LeadRow[],
  /**
   * Spend keyed by creative bucket key (`ad:<ad_id>` preferred, else name key).
   */
  spendByCreative: Map<string, { displayName: string; spend: number; adId?: string }>,
  knownAds: KnownAdsIndex,
  fromISO: string,
  toISO: string
): InsightsMetrics {
  const cohort = leads.filter((l) => inRange(l.created_at, fromISO, toISO));

  const formFilled = cohort.filter((l) => Boolean(l.form_filled_at));
  const formQualifiedNum = formFilled.filter((l) => l.qualified === true).length;

  const booked = cohort.filter((l) => Boolean(l.call_booked_at));
  const setterVerifiedNum = booked.filter((l) => l.setter_verified === true).length;

  const verified = cohort.filter((l) => l.setter_verified === true);
  const showedVerified = verified.filter((l) => l.call_showed === true);
  const closedFromShowed = showedVerified.filter((l) => l.deal_closed === true);

  const dailyMap = new Map(emptyDaily(fromISO, toISO).map((p) => [p.date, p]));
  const sourceCounts = new Map<string, number>();

  type Acc = {
    name: string;
    spend: number;
    callsBooked: number;
    qualified: number;
    showed: number;
    dealsClosed: number;
    revenue: number;
    leadIds: Set<string>;
  };

  const byCreative = new Map<string, Acc>();
  for (const [key, spend] of spendByCreative) {
    // Name-only keys are lookup aliases; display rows are keyed by ad:<id>.
    if (!key.startsWith("ad:")) continue;
    byCreative.set(key, {
      name: spend.displayName,
      spend: spend.spend,
      callsBooked: 0,
      qualified: 0,
      showed: 0,
      dealsClosed: 0,
      revenue: 0,
      leadIds: new Set()
    });
  }

  const unmatched: Acc = {
    name: "Unmatched",
    spend: 0,
    callsBooked: 0,
    qualified: 0,
    showed: 0,
    dealsClosed: 0,
    revenue: 0,
    leadIds: new Set()
  };

  function bucketKeyForMatch(match: CreativeMatch): string {
    return `ad:${match.adId}`;
  }

  function bucketFor(lead: LeadRow): Acc {
    const match = resolveCreativeMatch(lead.utm_content, knownAds);
    if (!match) return unmatched;

    const key = bucketKeyForMatch(match);
    const existing = byCreative.get(key);
    if (existing) return existing;

    const spendEntry =
      spendByCreative.get(key) ??
      (normalizeCreativeKey(match.adName)
        ? spendByCreative.get(normalizeCreativeKey(match.adName)!)
        : undefined);

    // Prefer folding name-key spend into the ad: row when both exist.
    const created: Acc = {
      name: match.adName || lead.utm_content || key,
      spend: spendByCreative.get(key)?.spend ?? spendEntry?.spend ?? 0,
      callsBooked: 0,
      qualified: 0,
      showed: 0,
      dealsClosed: 0,
      revenue: 0,
      leadIds: new Set()
    };
    byCreative.set(key, created);
    return created;
  }

  for (const lead of cohort) {
    const acc = bucketFor(lead);
    acc.leadIds.add(lead.id);

    if (lead.call_booked_at) {
      acc.callsBooked += 1;
      const src = lead.lead_source?.trim() || "(none)";
      sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
    }
    if (lead.setter_verified === true) acc.qualified += 1;
    if (lead.call_showed === true) acc.showed += 1;
    if (lead.deal_closed === true) {
      acc.dealsClosed += 1;
      acc.revenue += lead.deal_value ?? 0;
    }
  }

  // Daily trend: still event-in-range (any lead), not cohort-scoped.
  for (const lead of leads) {
    if (inRange(lead.call_booked_at, fromISO, toISO)) {
      const day = dailyMap.get(datePart(lead.call_booked_at!));
      if (day) day.callsBooked += 1;
    }
    if (lead.call_showed === true && inRange(lead.call_showed_at, fromISO, toISO)) {
      const day = dailyMap.get(datePart(lead.call_showed_at!));
      if (day) day.showUpCalls += 1;
    }
    if (lead.deal_closed === true && inRange(lead.closed_at, fromISO, toISO)) {
      const day = dailyMap.get(datePart(lead.closed_at!));
      if (day) day.dealsClosed += 1;
    }
  }

  function toRow(key: string, acc: Acc, unmatchedFlag: boolean): CreativeRow {
    return {
      key,
      name: acc.name,
      unmatched: unmatchedFlag,
      spend: acc.spend,
      callsBooked: acc.callsBooked,
      qualified: acc.qualified,
      showed: acc.showed,
      dealsClosed: acc.dealsClosed,
      revenue: acc.revenue,
      costPerBooked: cost(acc.spend, acc.callsBooked),
      costPerDeal: cost(acc.spend, acc.dealsClosed)
    };
  }

  const creatives = Array.from(byCreative.entries()).map(([key, acc]) =>
    toRow(key, acc, false)
  );
  creatives.push(toRow("unmatched", unmatched, true));

  const sourceBooked = Array.from(sourceCounts.entries())
    .map(([source, callsBooked]) => ({ source, callsBooked }))
    .sort((a, b) => b.callsBooked - a.callsBooked);

  return {
    formQualified: rate(formQualifiedNum, formFilled.length),
    setterVerified: rate(setterVerifiedNum, booked.length),
    showUp: rate(showedVerified.length, verified.length),
    closure: rate(closedFromShowed.length, showedVerified.length),
    creatives,
    unmatchedLeadCount: unmatched.leadIds.size,
    sourceBooked,
    daily: Array.from(dailyMap.values())
  };
}
