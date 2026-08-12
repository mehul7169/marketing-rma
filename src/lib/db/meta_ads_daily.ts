import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

export type MetaAdsDailyRow = {
  date: string; // YYYY-MM-DD
  campaign_id: string | null;
  campaign_name: string | null;
  ad_set_id: string;
  ad_set_name: string | null;
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

export type MetaAdsTableRow = {
  ad_set_id: string;
  ad_set_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
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

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function upsertMetaAdsDaily(rows: Array<Partial<MetaAdsDailyRow> & { date: string; ad_set_id: string }>) {
  if (!supabaseAdmin) {
    throw new Error("Supabase is not configured.");
  }
  // Table has: unique(date, ad_set_id)
  const payload = rows.map((r) => ({
    ...r,
    // Supabase `numeric` expects either number or string; we normalize to numbers.
    spend: r.spend ?? null,
    impressions: r.impressions ?? null,
    reach: r.reach ?? null,
    cpm: r.cpm ?? null,
    clicks: r.clicks ?? null,
    ctr: r.ctr ?? null,
    cpc: r.cpc ?? null,
    leads_meta_reported: r.leads_meta_reported ?? null,
    cost_per_lead: r.cost_per_lead ?? null,
    lp_conversion_rate: r.lp_conversion_rate ?? null
  }));

  const { error } = await supabaseAdmin.from("meta_ads_daily").upsert(payload, {
    onConflict: "date,ad_set_id"
  });

  if (error) throw error;
}

export async function getMetaAdsTrend(fromISO: string, toISO: string): Promise<MetaAdsTrendPoint[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("meta_ads_daily")
    .select("date, spend, clicks, leads_meta_reported")
    .gte("date", fromISO)
    .lte("date", toISO)
    .order("date", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  // Aggregate at app-level to keep DB queries simpler and robust.
  const byDate = new Map<string, { spend: number; clicks: number; leads: number }>();
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
    .map(([date, v]) => ({ date, spend: v.spend, leads: v.leads, clicks: v.clicks }));
}

export async function getMetaAdsAggregatedTable(fromISO: string, toISO: string): Promise<MetaAdsTableRow[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("meta_ads_daily")
    .select(
      [
        "ad_set_id",
        "ad_set_name",
        "campaign_id",
        "campaign_name",
        "spend",
        "impressions",
        "reach",
        "clicks",
        "leads_meta_reported"
      ].join(",")
    )
    .gte("date", fromISO)
    .lte("date", toISO);

  if (error) throw error;
  if (!data) return [];

  const byAdSet = new Map<string, Omit<MetaAdsTableRow, "ad_set_id"> & { ad_set_id: string }>();

  const typed = data as unknown as Array<{
    ad_set_id: string;
    ad_set_name: string | null;
    campaign_id: string | null;
    campaign_name: string | null;
    spend: unknown;
    impressions: unknown;
    reach: unknown;
    clicks: unknown;
    leads_meta_reported: unknown;
  }>;
  for (const row of typed) {
    const k = row.ad_set_id;
    const cur = byAdSet.get(k) ?? {
      ad_set_id: k,
      ad_set_name: row.ad_set_name ?? null,
      campaign_id: row.campaign_id ?? null,
      campaign_name: row.campaign_name ?? null,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      leads: 0,
      blended_cpm: 0,
      ctr_percent: 0,
      cpc: 0,
      lp_cvr_percent: 0,
      cost_per_lead: null
    };

    cur.spend += num(row.spend);
    cur.impressions += num(row.impressions);
    cur.reach += num(row.reach);
    cur.clicks += num(row.clicks);
    cur.leads += num(row.leads_meta_reported);

    byAdSet.set(k, cur);
  }

  return Array.from(byAdSet.values()).map((r) => {
    const blended_cpm = r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0;
    const ctr_percent = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
    const cpc = r.clicks > 0 ? r.spend / r.clicks : 0;
    const lp_cvr_percent = r.clicks > 0 ? (r.leads / r.clicks) * 100 : 0;
    const cost_per_lead = r.leads > 0 ? r.spend / r.leads : null;
    return {
      ...r,
      blended_cpm,
      ctr_percent,
      cpc,
      lp_cvr_percent,
      cost_per_lead
    };
  });
}

export async function getMetaAdsTotals(fromISO: string, toISO: string): Promise<{
  totalSpend: number;
  totalLeads: number;
  blendedCostPerLead: number | null;
  averageCtrPercent: number;
}> {
  if (!supabaseAdmin) {
    return { totalSpend: 0, totalLeads: 0, blendedCostPerLead: null, averageCtrPercent: 0 };
  }
  const { data, error } = await supabaseAdmin
    .from("meta_ads_daily")
    .select("spend, clicks, impressions, leads_meta_reported")
    .gte("date", fromISO)
    .lte("date", toISO);

  if (error) throw error;
  if (!data) return { totalSpend: 0, totalLeads: 0, blendedCostPerLead: null, averageCtrPercent: 0 };

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
  const averageCtrPercent = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return { totalSpend, totalLeads, blendedCostPerLead, averageCtrPercent };
}

