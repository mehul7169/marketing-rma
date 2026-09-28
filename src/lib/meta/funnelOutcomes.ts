import type {
  MetaAdNode,
  MetaCampaignNode
} from "@/lib/db/meta_ads_daily";
import {
  normalizeCreativeKey,
  resolveCreativeMatch,
  type KnownAdsIndex
} from "@/lib/insights/metrics";
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

function applyOutcomes<T extends {
  formFilled: number;
  booked: number;
  showed: number;
  dealsClosed: number;
  dealValue: number;
}>(node: T, o: MetaFunnelOutcomes): T {
  node.formFilled = o.formFilled;
  node.booked = o.booked;
  node.showed = o.showed;
  node.dealsClosed = o.dealsClosed;
  node.dealValue = o.dealValue;
  return node;
}

export type LeadAdResolution =
  | { matched: false }
  | { matched: true; ad: MetaAdNode | null };

/**
 * Resolve a lead to its hierarchy ad node: utm_content → ad_id first, then
 * ad_name. `matched: false` = matches no known Meta ad; `ad: null` = known ad
 * with no row in this hierarchy (date range).
 */
export function createLeadAdResolver(
  campaigns: MetaCampaignNode[],
  knownAds: KnownAdsIndex
): (lead: LeadRow) => LeadAdResolution {
  const adsById = new Map<string, MetaAdNode[]>();
  const adsByName = new Map<string, MetaAdNode[]>();

  for (const campaign of campaigns) {
    for (const adSet of campaign.ad_sets) {
      for (const ad of adSet.ads) {
        if (ad.ad_id) {
          const list = adsById.get(ad.ad_id) ?? [];
          list.push(ad);
          adsById.set(ad.ad_id, list);
        }
        const nameKey = normalizeCreativeKey(ad.ad_name);
        if (nameKey) {
          const list = adsByName.get(nameKey) ?? [];
          list.push(ad);
          adsByName.set(nameKey, list);
        }
      }
    }
  }

  return (lead) => {
    const match = resolveCreativeMatch(lead.utm_content, knownAds);
    if (!match) return { matched: false };

    const candidates =
      (match.matchedBy === "ad_id"
        ? adsById.get(match.adId)
        : adsByName.get(normalizeCreativeKey(match.adName) ?? "")) ?? [];

    // Prefer the hierarchy node that matches the resolved ad id when available.
    const byId = adsById.get(match.adId) ?? [];
    const ads = byId.length > 0 ? byId : candidates;
    if (ads.length === 0) return { matched: true, ad: null };

    return {
      matched: true,
      ad: ads.reduce((best, ad) => (ad.spend > best.spend ? ad : best))
    };
  };
}

export function leadsCreatedInRange(
  leads: LeadRow[],
  fromISO: string,
  toISO: string
): LeadRow[] {
  return leads.filter((l) => inCreatedRange(l, fromISO, toISO));
}

/**
 * Attribute cohort leads to ads: match utm_content → ad_id first, then ad_name.
 * Unmatched = cohort leads that match neither known Meta ad id nor ad name.
 */
export function attachMetaFunnelOutcomes(
  campaigns: MetaCampaignNode[],
  leads: LeadRow[],
  knownAds: KnownAdsIndex,
  fromISO: string,
  toISO: string
): { campaigns: MetaCampaignNode[]; unmatchedLeadCount: number } {
  for (const campaign of campaigns) {
    for (const adSet of campaign.ad_sets) {
      for (const ad of adSet.ads) applyOutcomes(ad, { ...EMPTY_FUNNEL_OUTCOMES });
    }
  }
  const resolve = createLeadAdResolver(campaigns, knownAds);

  let unmatchedLeadCount = 0;
  for (const lead of leadsCreatedInRange(leads, fromISO, toISO)) {
    const res = resolve(lead);
    if (!res.matched) {
      unmatchedLeadCount += 1;
      continue;
    }
    if (res.ad) addOutcomes(res.ad, outcomesFromLead(lead));
  }

  for (const campaign of campaigns) {
    for (const adSet of campaign.ad_sets) {
      applyOutcomes(
        adSet,
        sumOutcomes(
          adSet.ads.map((ad) => ({
            formFilled: ad.formFilled,
            booked: ad.booked,
            showed: ad.showed,
            dealsClosed: ad.dealsClosed,
            dealValue: ad.dealValue
          }))
        )
      );
    }
    applyOutcomes(
      campaign,
      sumOutcomes(
        campaign.ad_sets.map((adSet) => ({
          formFilled: adSet.formFilled,
          booked: adSet.booked,
          showed: adSet.showed,
          dealsClosed: adSet.dealsClosed,
          dealValue: adSet.dealValue
        }))
      )
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
