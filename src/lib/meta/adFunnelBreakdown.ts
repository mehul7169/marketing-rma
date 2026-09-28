import type { MetaAdNode, MetaCampaignNode } from "@/lib/db/meta_ads_daily";
import type { KnownAdsIndex } from "@/lib/insights/metrics";
import { leadReachedCohortStage } from "@/lib/leads/stageEvents";
import type { LeadRow } from "@/lib/leads/types";
import { createLeadAdResolver, leadsCreatedInRange } from "@/lib/meta/funnelOutcomes";

export const LANDING_PAGE_LEAD_SOURCES = ["facebook"] as const;
export const QUICKFORM_LEAD_SOURCES = ["quickform_fb", "quickform_ig"] as const;
export const AD_FUNNEL_LEAD_SOURCES = [
  ...LANDING_PAGE_LEAD_SOURCES,
  ...QUICKFORM_LEAD_SOURCES
];

export type AdFunnelClassification = "landing_page" | "quickform" | "mixed" | null;

export const AD_FUNNEL_COUNT_KEYS = [
  "landingPageViews",
  "optIns",
  "qualifiedOptIns",
  "callsBooked",
  "qualifiedCallsBooked",
  "qualifiedShowups"
] as const;

export type AdFunnelCountKey = (typeof AD_FUNNEL_COUNT_KEYS)[number];

/** null = metric does not apply to this row's classification (render as dash). */
export type AdFunnelCounts = Record<AdFunnelCountKey, number | null>;

export type AdFunnelMetrics = AdFunnelCounts & {
  spend: number;
  classification: AdFunnelClassification;
};

export type AdFunnelAdRow = AdFunnelMetrics & { ad_id: string; ad_name: string | null };
export type AdFunnelAdSetRow = AdFunnelMetrics & {
  ad_set_id: string;
  ad_set_name: string | null;
  ads: AdFunnelAdRow[];
};
export type AdFunnelCampaignRow = AdFunnelMetrics & {
  campaign_id: string;
  campaign_name: string | null;
  ad_sets: AdFunnelAdSetRow[];
};

const LP_SOURCES = new Set<string>(LANDING_PAGE_LEAD_SOURCES);
const QF_SOURCES = new Set<string>(QUICKFORM_LEAD_SOURCES);

function isLandingPageLead(lead: LeadRow): boolean {
  return LP_SOURCES.has(lead.lead_source ?? "");
}

function isQuickformLead(lead: LeadRow): boolean {
  return QF_SOURCES.has(lead.lead_source ?? "");
}

/** Form's own verdict — setter/admin edits overwrite qualified_by with an email. */
export function isFormQualified(lead: LeadRow): boolean {
  return lead.qualified === true && lead.qualified_by === "form";
}

/** Same definition as /leads?cohort=qualified_call_booked (call_confirmed). */
export function isQualifiedCallBooked(lead: LeadRow): boolean {
  return leadReachedCohortStage(lead, "qualified_call_booked");
}

function classify(lp: boolean, qf: boolean): AdFunnelClassification {
  if (lp && qf) return "mixed";
  if (lp) return "landing_page";
  if (qf) return "quickform";
  return null;
}

function appliesLandingPage(c: AdFunnelClassification): boolean {
  return c === "landing_page" || c === "mixed";
}

function emptyCounts(classification: AdFunnelClassification): AdFunnelCounts {
  const lp = appliesLandingPage(classification) ? 0 : null;
  return {
    landingPageViews: lp,
    optIns: lp,
    qualifiedOptIns: lp,
    callsBooked: lp,
    qualifiedCallsBooked: lp,
    qualifiedShowups: classification ? 0 : null
  };
}

function addNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return a + b;
}

export function rollupAdFunnel(
  children: AdFunnelMetrics[],
  spend: number
): AdFunnelMetrics {
  const hasLp = children.some((c) => appliesLandingPage(c.classification));
  const hasQf = children.some(
    (c) => c.classification === "quickform" || c.classification === "mixed"
  );
  const out: AdFunnelMetrics = { spend, classification: classify(hasLp, hasQf), ...emptyCounts(null) };
  for (const key of AD_FUNNEL_COUNT_KEYS) {
    out[key] = children.reduce<number | null>((sum, c) => addNullable(sum, c[key]), null);
  }
  return out;
}

/** spend / count; null when the metric is n/a or zero (never $0 or ∞). */
export function costPer(spend: number, count: number | null): number | null {
  if (count === null || count <= 0) return null;
  return spend / count;
}

/**
 * Per campaign → ad set → ad funnel table for /meta-ads.
 * Attribution reuses createLeadAdResolver (same as the Campaigns table).
 * Classification uses ALL leads ever resolved to an ad (not just this range),
 * so an LP ad with no opt-ins in range still reads as LP with 0. It goes
 * through the same resolver so same-named ads aren't all classified at once.
 */
export function buildAdFunnelBreakdown(
  campaigns: MetaCampaignNode[],
  allLeads: LeadRow[],
  knownAds: KnownAdsIndex,
  fromISO: string,
  toISO: string
): AdFunnelCampaignRow[] {
  const resolve = createLeadAdResolver(campaigns, knownAds);

  const lpAds = new Set<MetaAdNode>();
  const qfAds = new Set<MetaAdNode>();
  for (const lead of allLeads) {
    const bucket = isLandingPageLead(lead) ? lpAds : isQuickformLead(lead) ? qfAds : null;
    if (!bucket) continue;
    const res = resolve(lead);
    if (res.matched && res.ad) bucket.add(res.ad);
  }

  const adRows = new Map<MetaAdNode, AdFunnelAdRow>();
  for (const campaign of campaigns) {
    for (const adSet of campaign.ad_sets) {
      for (const ad of adSet.ads) {
        const classification = classify(lpAds.has(ad), qfAds.has(ad));
        const counts = emptyCounts(classification);
        if (counts.landingPageViews !== null) counts.landingPageViews = ad.landing_page_views;
        adRows.set(ad, {
          ad_id: ad.ad_id,
          ad_name: ad.ad_name,
          spend: ad.spend,
          classification,
          ...counts
        });
      }
    }
  }

  for (const lead of leadsCreatedInRange(allLeads, fromISO, toISO)) {
    const lp = isLandingPageLead(lead);
    if (!lp && !isQuickformLead(lead)) continue;
    const res = resolve(lead);
    if (!res.matched || !res.ad) continue;
    const row = adRows.get(res.ad);
    if (!row) continue;

    if (lp && row.optIns !== null) {
      row.optIns += 1;
      if (isFormQualified(lead)) row.qualifiedOptIns! += 1;
      if (leadReachedCohortStage(lead, "call_booked")) row.callsBooked! += 1;
      if (isQualifiedCallBooked(lead)) row.qualifiedCallsBooked! += 1;
    }
    if (
      row.qualifiedShowups !== null &&
      isQualifiedCallBooked(lead) &&
      leadReachedCohortStage(lead, "show_up")
    ) {
      row.qualifiedShowups += 1;
    }
  }

  return campaigns.map((campaign) => {
    const adSets: AdFunnelAdSetRow[] = campaign.ad_sets.map((adSet) => {
      const ads = adSet.ads.map((ad) => adRows.get(ad)!);
      return {
        ad_set_id: adSet.ad_set_id,
        ad_set_name: adSet.ad_set_name,
        ...rollupAdFunnel(ads, adSet.spend),
        ads
      };
    });
    return {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
      ...rollupAdFunnel(adSets, campaign.spend),
      ad_sets: adSets
    };
  });
}
