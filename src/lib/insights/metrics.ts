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
 * Date fields for each rate — using created_at for all of these would mix
 * people who filled a form last month with calls that happen this week.
 *
 * Form-qualified: form_filled_at. Denominator is form submits in range.
 * Setter-verified: call_booked_at. Of bookings made in range, how many the
 *   setter marked verified (verified is a property of the booking).
 * Show-up: call_scheduled_for. Of setter-verified calls scheduled in range,
 *   how many showed — not created_at, and not call_showed_at (a show logged
 *   late would otherwise leave the period of the actual call).
 * Closure: call_scheduled_for on the showed + setter-verified set. Same call
 *   cohort as the show-up numerator, so the two rates chain on the same calls.
 *
 * Daily series use the event timestamps specified in the insights page:
 * call_booked_at, call_showed_at, closed_at — bucketed by IST calendar day.
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
 * Name-based match: leads.utm_content ↔ meta_ads_daily.ad_name.
 * Not an ID match. If utm_content values ever drift from actual ad names in
 * Meta, this join silently stops matching — unmatchedLeadCount on the Ad
 * Creative breakdown is how that drop becomes visible.
 */
export function normalizeCreativeKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const t = name.trim().toLowerCase();
  return t.length ? t : null;
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
  spendByAdName: Map<string, { displayName: string; spend: number }>,
  knownAdNames: Map<string, string>,
  fromISO: string,
  toISO: string
): InsightsMetrics {
  const known = new Map(knownAdNames);
  for (const [key, v] of spendByAdName) {
    if (!known.has(key)) known.set(key, v.displayName);
  }

  const formFilled = leads.filter((l) => inRange(l.form_filled_at, fromISO, toISO));
  const formQualifiedNum = formFilled.filter((l) => l.qualified === true).length;

  const booked = leads.filter((l) => inRange(l.call_booked_at, fromISO, toISO));
  const setterVerifiedNum = booked.filter((l) => l.setter_verified === true).length;

  const scheduledVerified = leads.filter(
    (l) => l.setter_verified === true && inRange(l.call_scheduled_for, fromISO, toISO)
  );
  const showedVerified = scheduledVerified.filter((l) => l.call_showed === true);
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
  for (const [key, spend] of spendByAdName) {
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

  function bucketFor(lead: LeadRow): Acc {
    const key = normalizeCreativeKey(lead.utm_content);
    if (key && known.has(key)) {
      const existing = byCreative.get(key);
      if (existing) return existing;
      const created: Acc = {
        name: known.get(key) ?? lead.utm_content ?? key,
        spend: spendByAdName.get(key)?.spend ?? 0,
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
    return unmatched;
  }

  function touch(lead: LeadRow, acc: Acc) {
    acc.leadIds.add(lead.id);
  }

  for (const lead of leads) {
    if (inRange(lead.call_booked_at, fromISO, toISO)) {
      const src = lead.lead_source?.trim() || "(none)";
      sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
      const day = dailyMap.get(datePart(lead.call_booked_at!));
      if (day) day.callsBooked += 1;
      const acc = bucketFor(lead);
      acc.callsBooked += 1;
      touch(lead, acc);
    }

    if (lead.setter_verified === true && inRange(lead.setter_verified_at ?? lead.call_booked_at, fromISO, toISO)) {
      const acc = bucketFor(lead);
      acc.qualified += 1;
      touch(lead, acc);
    }

    if (lead.call_showed === true && inRange(lead.call_showed_at ?? lead.call_scheduled_for, fromISO, toISO)) {
      const acc = bucketFor(lead);
      acc.showed += 1;
      touch(lead, acc);
    }

    if (lead.deal_closed === true && inRange(lead.closed_at, fromISO, toISO)) {
      const acc = bucketFor(lead);
      acc.dealsClosed += 1;
      acc.revenue += lead.deal_value ?? 0;
      touch(lead, acc);
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
    showUp: rate(showedVerified.length, scheduledVerified.length),
    closure: rate(closedFromShowed.length, showedVerified.length),
    creatives,
    unmatchedLeadCount: unmatched.leadIds.size,
    sourceBooked,
    daily: Array.from(dailyMap.values())
  };
}
