import type {
  MetaAdNode,
  MetaAdsMetrics,
  MetaCampaignNode
} from "@/lib/db/meta_ads_daily";
import { normalizeCreativeKey } from "@/lib/insights/metrics";
import type { LeadRow } from "@/lib/leads/types";
import { toISTDateString } from "@/lib/timezone";

export type MetaFunnelOutcomes = {
  formFilled: number;
  booked: number;
  showed: number;
  dealsClosed: number;
  dealValue: number;
};

export const EMPTY_FUNNEL_OUTCOMES: MetaFunnelOutcomes = {
  formFilled: 0,
  booked: 0,
  showed: 0,
  dealsClosed: 0,
  dealValue: 0
};

function inCreatedRange(lead: LeadRow, fromISO: string, toISO: string): boolean {
  if (!lead.created_at) return false;
  const d = toISTDateString(lead.created_at);
  return d >= fromISO && d <= toISO;
}

function outcomesFromLead(lead: LeadRow): MetaFunnelOutcomes {
  const closed = lead.deal_closed === true;
  return {
    formFilled: 1,
    booked: lead.call_booked_at ? 1 : 0,
    showed: lead.call_showed === true ? 1 : 0,
    dealsClosed: closed ? 1 : 0,
    dealValue: closed ? (lead.deal_value ?? 0) : 0
  };
}

function addOutcomes(into: MetaFunnelOutcomes, add: MetaFunnelOutcomes) {
  into.formFilled += add.formFilled;
  into.booked += add.booked;
  into.showed += add.showed;
  into.dealsClosed += add.dealsClosed;
  into.dealValue += add.dealValue;
}

function sumOutcomes(parts: MetaFunnelOutcomes[]): MetaFunnelOutcomes {
  const out = { ...EMPTY_FUNNEL_OUTCOMES };
  for (const p of parts) addOutcomes(out, p);
  return out;
}

function applyOutcomes<T extends MetaAdsMetrics>(node: T, o: MetaFunnelOutcomes): T {
  node.formFilled = o.formFilled;
  node.booked = o.booked;
  node.showed = o.showed;
  node.dealsClosed = o.dealsClosed;
  node.dealValue = o.dealValue;
  return node;
}

/**
 * Attribute cohort leads (created_at in range) to ads via utm_content ↔ ad_name,
 * then roll Form Filled / Booked / Showed / Closed / Deal Value up the hierarchy.
 * Unmatched = cohort leads whose utm_content matches no known Meta ad_name.
 */
export function attachMetaFunnelOutcomes(
  campaigns: MetaCampaignNode[],
  leads: LeadRow[],
  knownAdNames: Map<string, string>,
  fromISO: string,
  toISO: string
): { campaigns: MetaCampaignNode[]; unmatchedLeadCount: number } {
  const adsByName = new Map<string, MetaAdNode[]>();
  for (const campaign of campaigns) {
    for (const adSet of campaign.ad_sets) {
      for (const ad of adSet.ads) {
        applyOutcomes(ad, { ...EMPTY_FUNNEL_OUTCOMES });
        const key = normalizeCreativeKey(ad.ad_name);
        if (!key) continue;
        const list = adsByName.get(key) ?? [];
        list.push(ad);
        adsByName.set(key, list);
      }
    }
  }

  let unmatchedLeadCount = 0;
  const cohort = leads.filter((l) => inCreatedRange(l, fromISO, toISO));

  for (const lead of cohort) {
    const key = normalizeCreativeKey(lead.utm_content);
    if (!key || !knownAdNames.has(key)) {
      unmatchedLeadCount += 1;
      continue;
    }
    const ads = adsByName.get(key);
    if (!ads || ads.length === 0) continue;

    // One lead → one ad. If duplicate ad_names exist in-range, prefer highest spend.
    const target = ads.reduce((best, ad) => (ad.spend > best.spend ? ad : best));
    addOutcomes(target, outcomesFromLead(lead));
  }

  for (const campaign of campaigns) {
    for (const adSet of campaign.ad_sets) {
      applyOutcomes(
        adSet,
        sumOutcomes(adSet.ads.map((ad) => ({
          formFilled: ad.formFilled,
          booked: ad.booked,
          showed: ad.showed,
          dealsClosed: ad.dealsClosed,
          dealValue: ad.dealValue
        })))
      );
    }
    applyOutcomes(
      campaign,
      sumOutcomes(campaign.ad_sets.map((adSet) => ({
        formFilled: adSet.formFilled,
        booked: adSet.booked,
        showed: adSet.showed,
        dealsClosed: adSet.dealsClosed,
        dealValue: adSet.dealValue
      })))
    );
  }

  return { campaigns, unmatchedLeadCount };
}

export function sumCampaignFunnelOutcomes(
  campaigns: MetaCampaignNode[]
): MetaFunnelOutcomes {
  return sumOutcomes(
    campaigns.map((c) => ({
      formFilled: c.formFilled,
      booked: c.booked,
      showed: c.showed,
      dealsClosed: c.dealsClosed,
      dealValue: c.dealValue
    }))
  );
}
