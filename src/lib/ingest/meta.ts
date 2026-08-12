import { upsertMetaAdsDaily } from "@/lib/db/meta_ads_daily";
import type { MetaAdsDailyRow } from "@/lib/db/meta_ads_daily";

export type MetaAction = { action_type: string; value: string };
export type MetaCostPerAction = { action_type: string; value: string };

/**
 * Insights fields requested from Meta. Add new names here when extending
 * ingestion — keep this as the single source of truth (not scattered inline).
 */
export const META_INSIGHTS_FIELDS = [
  "date_start",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "reach",
  "cpm",
  "clicks",
  "ctr",
  "cpc",
  "actions",
  "cost_per_action_type"
] as const;

export type MetaInsightsRow = {
  date_start: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string;
  adset_name: string | null;
  ad_id: string;
  ad_name: string | null;
  spend: string | null;
  impressions: string | null;
  reach: string | null;
  cpm: string | null;
  clicks: string | null;
  ctr: string | null;
  cpc: string | null;
  actions: MetaAction[] | null;
  cost_per_action_type: MetaCostPerAction[] | null;
};

export type MetaIngestConfig = {
  accessToken: string;
  adAccountId: string;
};

function numOrNull(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function extractLeads(actions: MetaAction[] | null): number | null {
  if (!actions || actions.length === 0) return null;
  const leadAction = actions.find((a) => {
    const t = a.action_type.toLowerCase();
    return t === "lead" || t.includes("lead");
  });
  if (!leadAction) return null;
  const n = Number(leadAction.value);
  return Number.isFinite(n) ? n : null;
}

export function extractCostPerLead(
  costPerAction: MetaCostPerAction[] | null
): number | null {
  if (!costPerAction || costPerAction.length === 0) return null;
  const leadCPA = costPerAction.find((a) =>
    a.action_type.toLowerCase().includes("lead")
  );
  if (!leadCPA) return null;
  const n = Number(leadCPA.value);
  return Number.isFinite(n) ? n : null;
}

export function transformMetaInsightsRows(
  rows: MetaInsightsRow[]
): Array<Partial<MetaAdsDailyRow> & { date: string; ad_id: string; ad_set_id: string }> {
  return rows
    .filter((r) => r.ad_id && r.adset_id && r.date_start)
    .map((r) => {
      const leads = extractLeads(r.actions);
      const costPerLead = extractCostPerLead(r.cost_per_action_type);
      const spend = numOrNull(r.spend);
      const clicks = numOrNull(r.clicks);
      const computedCostPerLead =
        spend !== null && leads && leads > 0 ? spend / leads : null;
      const computedLpConversionRate =
        leads !== null && clicks !== null && clicks > 0 ? leads / clicks : null;

      return {
        date: r.date_start,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        ad_set_id: r.adset_id,
        ad_set_name: r.adset_name,
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        // Thumbnail would require one extra Graph call per ad; skip during
        // ingest so spend/leads are never blocked by rate limits.
        creative_thumbnail_url: null,
        utm_term: null,
        spend,
        impressions: numOrNull(r.impressions),
        reach: numOrNull(r.reach),
        cpm: numOrNull(r.cpm),
        clicks,
        ctr: numOrNull(r.ctr),
        cpc: numOrNull(r.cpc),
        leads_meta_reported: leads,
        cost_per_lead: costPerLead ?? computedCostPerLead,
        lp_conversion_rate: computedLpConversionRate
      };
    });
}

export async function fetchMetaInsights(
  config: MetaIngestConfig,
  sinceISO: string,
  untilISO: string
): Promise<MetaInsightsRow[]> {
  const actId = config.adAccountId.startsWith("act_")
    ? config.adAccountId
    : `act_${config.adAccountId}`;
  const endpoint = `https://graph.facebook.com/v19.0/${actId}/insights`;

  const params = new URLSearchParams({
    access_token: config.accessToken,
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since: sinceISO, until: untilISO }),
    fields: META_INSIGHTS_FIELDS.join(",")
  });

  const rows: MetaInsightsRow[] = [];
  let url: string | null = `${endpoint}?${params.toString()}`;

  for (let page = 0; page < 50 && url; page++) {
    const res = await fetch(url, { method: "GET" });
    const json = (await res.json()) as {
      data?: MetaInsightsRow[];
      paging?: { next?: string };
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(
        `Meta insights error: ${json.error?.message ?? JSON.stringify(json).slice(0, 1000)}`
      );
    }

    if (json.data) rows.push(...json.data);
    url = json.paging?.next ?? null;
  }

  return rows;
}

export async function ingestMetaAdsRange(
  config: MetaIngestConfig,
  sinceISO: string,
  untilISO: string
): Promise<number> {
  const raw = await fetchMetaInsights(config, sinceISO, untilISO);
  const payload = transformMetaInsightsRows(raw);
  if (payload.length > 0) {
    await upsertMetaAdsDaily(payload);
  }
  return payload.length;
}

export function getMetaIngestConfigFromEnv(): MetaIngestConfig {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    throw new Error("Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID");
  }

  return { accessToken, adAccountId };
}
