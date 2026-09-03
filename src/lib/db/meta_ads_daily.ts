import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

export type MetaActionEntry = { action_type: string; value: string };

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
  results: number | null;
  cost_per_result: number | null;
  actions: MetaActionEntry[] | null;
  unique_outbound_clicks: number | null;
  unique_outbound_ctr: number | null;
  cost_per_unique_outbound_click: number | null;
  appointments_scheduled: number | null;
  cost_per_appointment_scheduled: number | null;
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
  results: number;
  cost_per_result: number | null;
  actions: MetaActionEntry[];
  unique_outbound_clicks: number;
  unique_outbound_ctr: number;
  cost_per_unique_outbound_click: number | null;
  appointments_scheduled: number;
  cost_per_appointment_scheduled: number | null;
  /** Cohort funnel outcomes (created_at in range, utm_content ↔ ad_name). */
  formFilled: number;
  booked: number;
  showed: number;
  dealsClosed: number;
  dealValue: number;
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

function mergeActions(
  into: Map<string, number>,
  actions: MetaActionEntry[] | null | undefined
) {
  if (!actions) return;
  for (const a of actions) {
    const n = Number(a.value);
    if (!Number.isFinite(n)) continue;
    into.set(a.action_type, (into.get(a.action_type) ?? 0) + n);
  }
}

function actionsFromMap(map: Map<string, number>): MetaActionEntry[] {
  return Array.from(map.entries())
    .map(([action_type, value]) => ({
      action_type,
      value: String(value)
    }))
    .sort((a, b) => a.action_type.localeCompare(b.action_type));
}

function withDerivedMetrics<
  T extends {
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    leads: number;
    results: number;
    unique_outbound_clicks: number;
    appointments_scheduled: number;
    actions: MetaActionEntry[];
  },
>(
  r: T,
): T &
  Pick<
    MetaAdsMetrics,
    | "blended_cpm"
    | "ctr_percent"
    | "cpc"
    | "lp_cvr_percent"
    | "cost_per_lead"
    | "cost_per_result"
    | "unique_outbound_ctr"
    | "cost_per_unique_outbound_click"
    | "cost_per_appointment_scheduled"
  > {
  return {
    ...r,
    blended_cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0,
    ctr_percent: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
    cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
    lp_cvr_percent: r.clicks > 0 ? (r.leads / r.clicks) * 100 : 0,
    cost_per_lead: r.leads > 0 ? r.spend / r.leads : null,
    cost_per_result: r.results > 0 ? r.spend / r.results : null,
    unique_outbound_ctr:
      r.reach > 0 ? (r.unique_outbound_clicks / r.reach) * 100 : 0,
    cost_per_unique_outbound_click:
      r.unique_outbound_clicks > 0
        ? r.spend / r.unique_outbound_clicks
        : null,
    cost_per_appointment_scheduled:
      r.appointments_scheduled > 0
        ? r.spend / r.appointments_scheduled
        : null,
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
    results: r.results ?? null,
    cost_per_result: r.cost_per_result ?? null,
    actions: r.actions ?? null,
    unique_outbound_clicks: r.unique_outbound_clicks ?? null,
    unique_outbound_ctr: r.unique_outbound_ctr ?? null,
    cost_per_unique_outbound_click: r.cost_per_unique_outbound_click ?? null,
    appointments_scheduled: r.appointments_scheduled ?? null,
    cost_per_appointment_scheduled: r.cost_per_appointment_scheduled ?? null,
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
  results: unknown;
  actions: MetaActionEntry[] | null;
  unique_outbound_clicks: unknown;
  appointments_scheduled: unknown;
};

type MetricAcc = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  results: number;
  unique_outbound_clicks: number;
  appointments_scheduled: number;
  actionMap: Map<string, number>;
};

function emptyMetrics(): MetricAcc {
  return {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    leads: 0,
    results: 0,
    unique_outbound_clicks: 0,
    appointments_scheduled: 0,
    actionMap: new Map(),
  };
}

function addMetrics(acc: MetricAcc, row: DailyGrain) {
  acc.spend += num(row.spend);
  acc.impressions += num(row.impressions);
  acc.reach += num(row.reach);
  acc.clicks += num(row.clicks);
  acc.leads += num(row.leads_meta_reported);
  acc.results += num(row.results);
  acc.unique_outbound_clicks += num(row.unique_outbound_clicks);
  acc.appointments_scheduled += num(row.appointments_scheduled);
  mergeActions(acc.actionMap, row.actions);
}

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
        "results",
        "actions",
        "unique_outbound_clicks",
        "appointments_scheduled",
      ].join(","),
    )
    .gte("date", fromISO)
    .lte("date", toISO);

  if (error) throw error;
  if (!data) return [];

  type AdAcc = MetricAcc & {
    ad_id: string;
    ad_name: string | null;
    creative_thumbnail_url: string | null;
  };
  type AdSetAcc = MetricAcc & {
    ad_set_id: string;
    ad_set_name: string | null;
    ads: Map<string, AdAcc>;
  };
  type CampaignAcc = MetricAcc & {
    campaign_id: string;
    campaign_name: string | null;
    ad_sets: Map<string, AdSetAcc>;
  };

  const campaigns = new Map<string, CampaignAcc>();

  for (const row of data as unknown as DailyGrain[]) {
    if (!row.ad_id || !row.ad_set_id) continue;
    const campaignId = row.campaign_id ?? "unknown";
    const campaign =
      campaigns.get(campaignId) ??
      ({
        campaign_id: campaignId,
        campaign_name: row.campaign_name ?? null,
        ad_sets: new Map(),
        ...emptyMetrics(),
      } satisfies CampaignAcc);

    const adSet =
      campaign.ad_sets.get(row.ad_set_id) ??
      ({
        ad_set_id: row.ad_set_id,
        ad_set_name: row.ad_set_name ?? null,
        ads: new Map(),
        ...emptyMetrics(),
      } satisfies AdSetAcc);

    const ad =
      adSet.ads.get(row.ad_id) ??
      ({
        ad_id: row.ad_id,
        ad_name: row.ad_name ?? null,
        creative_thumbnail_url: row.creative_thumbnail_url ?? null,
        ...emptyMetrics(),
      } satisfies AdAcc);

    addMetrics(ad, row);
    addMetrics(adSet, row);
    addMetrics(campaign, row);

    if (!ad.ad_name && row.ad_name) ad.ad_name = row.ad_name;
    if (!ad.creative_thumbnail_url && row.creative_thumbnail_url) {
      ad.creative_thumbnail_url = row.creative_thumbnail_url;
    }
    if (!adSet.ad_set_name && row.ad_set_name) {
      adSet.ad_set_name = row.ad_set_name;
    }
    if (!campaign.campaign_name && row.campaign_name) {
      campaign.campaign_name = row.campaign_name;
    }

    adSet.ads.set(row.ad_id, ad);
    campaign.ad_sets.set(row.ad_set_id, adSet);
    campaigns.set(campaignId, campaign);
  }

  function finalizeMetrics(acc: MetricAcc) {
    return {
      spend: acc.spend,
      impressions: acc.impressions,
      reach: acc.reach,
      clicks: acc.clicks,
      leads: acc.leads,
      results: acc.results,
      unique_outbound_clicks: acc.unique_outbound_clicks,
      appointments_scheduled: acc.appointments_scheduled,
      actions: actionsFromMap(acc.actionMap),
      formFilled: 0,
      booked: 0,
      showed: 0,
      dealsClosed: 0,
      dealValue: 0,
    };
  }

  return Array.from(campaigns.values()).map((campaign) =>
    withDerivedMetrics({
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
      ...finalizeMetrics(campaign),
      ad_sets: Array.from(campaign.ad_sets.values()).map((adSet) =>
        withDerivedMetrics({
          ad_set_id: adSet.ad_set_id,
          ad_set_name: adSet.ad_set_name,
          ...finalizeMetrics(adSet),
          ads: Array.from(adSet.ads.values()).map((ad) =>
            withDerivedMetrics({
              ad_id: ad.ad_id,
              ad_name: ad.ad_name,
              creative_thumbnail_url: ad.creative_thumbnail_url,
              ...finalizeMetrics(ad),
            }),
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
