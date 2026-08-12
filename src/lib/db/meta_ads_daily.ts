import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

export type MetaAdsDailyRow = {
  date: string; // YYYY-MM-DD
  campaign_id: string | null;
  campaign_name: string | null;
  ad_set_id: string;
  ad_set_name: string | null;
  ad_id: string;
  ad_name: string | null;
  creative_thumbnail_url: string | null;
  utm_term: string | null;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  cpm: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  leads_meta_reported: number | null;
  cost_per_lead: number | null;
  lp_conversion_rate: number | null;
  created_at: string | null;
};

export type MetaAdsTrendPoint = {
  date: string; // YYYY-MM-DD
  spend: number;
  leads: number;
  clicks: number;
};

export type MetaAdsMetrics = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  blended_cpm: number;
  ctr_percent: number;
  cpc: number;
  lp_cvr_percent: number;
  cost_per_lead: number | null;
};

export type MetaAdNode = MetaAdsMetrics & {
  ad_id: string;
  ad_name: string | null;
  creative_thumbnail_url: string | null;
};

export type MetaAdSetNode = MetaAdsMetrics & {
  ad_set_id: string;
  ad_set_name: string | null;
  ads: MetaAdNode[];
};

export type MetaCampaignNode = MetaAdsMetrics & {
  campaign_id: string;
  campaign_name: string | null;
  ad_sets: MetaAdSetNode[];
};

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function withDerivedMetrics<
  T extends {
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    leads: number;
  },
>(
  r: T,
): T &
  Pick<
    MetaAdsMetrics,
    "blended_cpm" | "ctr_percent" | "cpc" | "lp_cvr_percent" | "cost_per_lead"
  > {
  return {
    ...r,
    blended_cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0,
    ctr_percent: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
    cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
    lp_cvr_percent: r.clicks > 0 ? (r.leads / r.clicks) * 100 : 0,
    cost_per_lead: r.leads > 0 ? r.spend / r.leads : null,
  };
}

export async function upsertMetaAdsDaily(
  rows: Array<
    Partial<MetaAdsDailyRow> & {
      date: string;
      ad_id: string;
      ad_set_id: string;
    }
  >,
) {
  if (!supabaseAdmin) {
    throw new Error("Supabase is not configured.");
  }
  const payload = rows.map((r) => ({
    ...r,
    spend: r.spend ?? null,
    impressions: r.impressions ?? null,
    reach: r.reach ?? null,
    cpm: r.cpm ?? null,
    clicks: r.clicks ?? null,
    ctr: r.ctr ?? null,
    cpc: r.cpc ?? null,
    leads_meta_reported: r.leads_meta_reported ?? null,
    cost_per_lead: r.cost_per_lead ?? null,
    lp_conversion_rate: r.lp_conversion_rate ?? null,
    creative_thumbnail_url: r.creative_thumbnail_url ?? null,
  }));

  const { error } = await supabaseAdmin.from("meta_ads_daily").upsert(payload, {
    onConflict: "date,ad_id",
  });

  if (error) throw error;
}

export async function truncateMetaAdsDaily() {
  if (!supabaseAdmin) {
    throw new Error("Supabase is not configured.");
  }
  const { error } = await supabaseAdmin
    .from("meta_ads_daily")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) throw error;
}

export async function getMetaAdsTrend(
  fromISO: string,
  toISO: string,
): Promise<MetaAdsTrendPoint[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("meta_ads_daily")
    .select("date, spend, clicks, leads_meta_reported")
    .gte("date", fromISO)
    .lte("date", toISO)
    .order("date", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  const byDate = new Map<
    string,
    { spend: number; clicks: number; leads: number }
  >();
  const typed = data as unknown as Array<{
    date: string;
    spend: unknown;
    clicks: unknown;
    leads_meta_reported: unknown;
  }>;
  for (const row of typed) {
    const k = row.date;
    const cur = byDate.get(k) ?? { spend: 0, clicks: 0, leads: 0 };
    cur.spend += num(row.spend);
    cur.clicks += num(row.clicks);
    cur.leads += num(row.leads_meta_reported);
    byDate.set(k, cur);
  }

  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, v]) => ({
      date,
      spend: v.spend,
      leads: v.leads,
      clicks: v.clicks,
    }));
}

type DailyGrain = {
  campaign_id: string | null;
  campaign_name: string | null;
  ad_set_id: string;
  ad_set_name: string | null;
  ad_id: string;
  ad_name: string | null;
  creative_thumbnail_url: string | null;
  spend: unknown;
  impressions: unknown;
  reach: unknown;
  clicks: unknown;
  leads_meta_reported: unknown;
};

export async function getMetaAdsHierarchy(
  fromISO: string,
  toISO: string,
): Promise<MetaCampaignNode[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("meta_ads_daily")
    .select(
      [
        "campaign_id",
        "campaign_name",
        "ad_set_id",
        "ad_set_name",
        "ad_id",
        "ad_name",
        "creative_thumbnail_url",
        "spend",
        "impressions",
        "reach",
        "clicks",
        "leads_meta_reported",
      ].join(","),
    )
    .gte("date", fromISO)
    .lte("date", toISO);

  if (error) throw error;
  if (!data) return [];

  type AdAcc = {
    ad_id: string;
    ad_name: string | null;
    creative_thumbnail_url: string | null;
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    leads: number;
  };
  type AdSetAcc = {
    ad_set_id: string;
    ad_set_name: string | null;
    ads: Map<string, AdAcc>;
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    leads: number;
  };
  type CampaignAcc = {
    campaign_id: string;
    campaign_name: string | null;
    ad_sets: Map<string, AdSetAcc>;
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    leads: number;
  };

  const campaigns = new Map<string, CampaignAcc>();

  for (const row of data as unknown as DailyGrain[]) {
    if (!row.ad_id || !row.ad_set_id) continue;
    const campaignId = row.campaign_id ?? "unknown";
    const campaign = campaigns.get(campaignId) ?? {
      campaign_id: campaignId,
      campaign_name: row.campaign_name ?? null,
      ad_sets: new Map(),
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      leads: 0,
    };

    const adSet = campaign.ad_sets.get(row.ad_set_id) ?? {
      ad_set_id: row.ad_set_id,
      ad_set_name: row.ad_set_name ?? null,
      ads: new Map(),
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      leads: 0,
    };

    const ad = adSet.ads.get(row.ad_id) ?? {
      ad_id: row.ad_id,
      ad_name: row.ad_name ?? null,
      creative_thumbnail_url: row.creative_thumbnail_url ?? null,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      leads: 0,
    };

    const spend = num(row.spend);
    const impressions = num(row.impressions);
    const reach = num(row.reach);
    const clicks = num(row.clicks);
    const leads = num(row.leads_meta_reported);

    ad.spend += spend;
    ad.impressions += impressions;
    ad.reach += reach;
    ad.clicks += clicks;
    ad.leads += leads;
    if (!ad.ad_name && row.ad_name) ad.ad_name = row.ad_name;
    if (!ad.creative_thumbnail_url && row.creative_thumbnail_url) {
      ad.creative_thumbnail_url = row.creative_thumbnail_url;
    }

    adSet.spend += spend;
    adSet.impressions += impressions;
    adSet.reach += reach;
    adSet.clicks += clicks;
    adSet.leads += leads;
    if (!adSet.ad_set_name && row.ad_set_name)
      adSet.ad_set_name = row.ad_set_name;

    campaign.spend += spend;
    campaign.impressions += impressions;
    campaign.reach += reach;
    campaign.clicks += clicks;
    campaign.leads += leads;
    if (!campaign.campaign_name && row.campaign_name) {
      campaign.campaign_name = row.campaign_name;
    }

    adSet.ads.set(row.ad_id, ad);
    campaign.ad_sets.set(row.ad_set_id, adSet);
    campaigns.set(campaignId, campaign);
  }

  return Array.from(campaigns.values()).map((campaign) =>
    withDerivedMetrics({
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
      spend: campaign.spend,
      impressions: campaign.impressions,
      reach: campaign.reach,
      clicks: campaign.clicks,
      leads: campaign.leads,
      ad_sets: Array.from(campaign.ad_sets.values()).map((adSet) =>
        withDerivedMetrics({
          ad_set_id: adSet.ad_set_id,
          ad_set_name: adSet.ad_set_name,
          spend: adSet.spend,
          impressions: adSet.impressions,
          reach: adSet.reach,
          clicks: adSet.clicks,
          leads: adSet.leads,
          ads: Array.from(adSet.ads.values()).map((ad) =>
            withDerivedMetrics(ad),
          ),
        }),
      ),
    }),
  );
}

export async function getMetaAdsTotals(
  fromISO: string,
  toISO: string,
): Promise<{
  totalSpend: number;
  totalLeads: number;
  blendedCostPerLead: number | null;
  averageCtrPercent: number;
}> {
  if (!supabaseAdmin) {
    return {
      totalSpend: 0,
      totalLeads: 0,
      blendedCostPerLead: null,
      averageCtrPercent: 0,
    };
  }
  const { data, error } = await supabaseAdmin
    .from("meta_ads_daily")
    .select("spend, clicks, impressions, leads_meta_reported")
    .gte("date", fromISO)
    .lte("date", toISO);

  if (error) throw error;
  if (!data)
    return {
      totalSpend: 0,
      totalLeads: 0,
      blendedCostPerLead: null,
      averageCtrPercent: 0,
    };

  let totalSpend = 0;
  let totalLeads = 0;
  let totalClicks = 0;
  let totalImpressions = 0;

  const typed = data as unknown as Array<{
    spend: unknown;
    leads_meta_reported: unknown;
    clicks: unknown;
    impressions: unknown;
  }>;
  for (const row of typed) {
    totalSpend += num(row.spend);
    totalLeads += num(row.leads_meta_reported);
    totalClicks += num(row.clicks);
    totalImpressions += num(row.impressions);
  }

  const blendedCostPerLead = totalLeads > 0 ? totalSpend / totalLeads : null;
  const averageCtrPercent =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return { totalSpend, totalLeads, blendedCostPerLead, averageCtrPercent };
}
