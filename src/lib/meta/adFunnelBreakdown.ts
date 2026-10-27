import type { MetaAdNode, MetaCampaignNode } from "@/lib/db/meta_ads_daily";
import type { KnownAdsIndex } from "@/lib/insights/metrics";
import { leadHitsKpiInRange } from "@/lib/leads/lifecycleDefinitions";
import type { LeadRow } from "@/lib/leads/types";
import { createLeadAdResolver } from "@/lib/meta/funnelOutcomes";

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
  "showups",
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
  const any = classification ? 0 : null;
  return {
    landingPageViews: lp,
    optIns: lp,
    qualifiedOptIns: lp,
    callsBooked: any,
    showups: any,
    qualifiedShowups: any
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
 * Each count is a lifecycleDefinitions KPI bucketed by its own milestone date,
 * so allLeads must be all-time (not just leads created in range).
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

  const hit = (lead: LeadRow, kpi: Parameters<typeof leadHitsKpiInRange>[1]) =>
    leadHitsKpiInRange(lead, kpi, fromISO, toISO);
  for (const lead of allLeads) {
    const lp = isLandingPageLead(lead);
    if (!lp && !isQuickformLead(lead)) continue;
    const res = resolve(lead);
    if (!res.matched || !res.ad) continue;
    const row = adRows.get(res.ad);
    if (!row || row.callsBooked === null) continue;

    if (lp && row.optIns !== null) {
      if (hit(lead, "leads")) row.optIns += 1;
      if (hit(lead, "form_qualified_opt_ins")) row.qualifiedOptIns! += 1;
    }
    if (hit(lead, "calls_booked")) row.callsBooked += 1;
    if (hit(lead, "showups")) row.showups! += 1;
    if (hit(lead, "qualified_showups")) row.qualifiedShowups! += 1;
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
