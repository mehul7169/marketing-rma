import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { getOrgMetaAdAccountIds } from "@/lib/ad-accounts/getRmaAccountId";
import { listAllLeads, listDistinctLeadSources } from "@/lib/db/leads";
import {
  computeInsights,
  normalizeCreativeKey,
  type InsightsMetrics,
  type KnownAdsIndex
} from "@/lib/insights/metrics";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function paginate<T>(
  select: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await select(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

/** Spend for Insights creative table — keyed by `ad:<ad_id>` (and name fallback keys). */
export async function getMetaSpendByCreative(
  fromISO: string,
  toISO: string,
  orgId: string
): Promise<Map<string, { displayName: string; spend: number; adId?: string }>> {
  const map = new Map<string, { displayName: string; spend: number; adId?: string }>();
  if (!supabaseAdmin) return map;
  const accountIds = await getOrgMetaAdAccountIds(orgId);
  if (accountIds.length === 0) return map;

  const rows = await paginate<{
    ad_id: string | null;
    ad_name: string | null;
    spend: unknown;
  }>((from, to) =>
    supabaseAdmin!
      .from("meta_ads_daily")
      .select("ad_id, ad_name, spend")
      .in("ad_account_id", accountIds)
      .gte("date", fromISO)
      .lte("date", toISO)
      .range(from, to)
  );

  for (const row of rows) {
    const spend = num(row.spend);
    const displayName = (row.ad_name ?? row.ad_id ?? "Unknown").trim();
    if (row.ad_id) {
      const key = `ad:${row.ad_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.spend += spend;
        if (!existing.displayName && displayName) existing.displayName = displayName;
      } else {
        map.set(key, { displayName, spend, adId: row.ad_id });
      }
    }
    const nameKey = normalizeCreativeKey(row.ad_name);
    if (nameKey) {
      const existing = map.get(nameKey);
      if (existing) {
        existing.spend += spend;
      } else {
        map.set(nameKey, {
          displayName,
          spend,
          adId: row.ad_id ?? undefined
        });
      }
    }
  }
  return map;
}

/** @deprecated Prefer listKnownAdsIndex — kept for any name-only callers. */
export async function listKnownAdNames(orgId: string): Promise<Map<string, string>> {
  const index = await listKnownAdsIndex(orgId);
  const map = new Map<string, string>();
  for (const [key, ref] of index.byAdName) {
    map.set(key, ref.adName);
  }
  return map;
}

export async function listKnownAdsIndex(orgId: string): Promise<KnownAdsIndex> {
  const byAdId = new Map<string, string>();
  const byAdName = new Map<string, { adId: string; adName: string }>();
  if (!supabaseAdmin) return { byAdId, byAdName };
  const accountIds = await getOrgMetaAdAccountIds(orgId);
  if (accountIds.length === 0) return { byAdId, byAdName };

  const rows = await paginate<{ ad_id: string | null; ad_name: string | null }>(
    (from, to) =>
      supabaseAdmin!
        .from("meta_ads_daily")
        .select("ad_id, ad_name")
        .in("ad_account_id", accountIds)
        .range(from, to)
  );

  for (const row of rows) {
    const adId = row.ad_id?.trim();
    const adName = row.ad_name?.trim() || "";
    if (adId && !byAdId.has(adId)) {
      byAdId.set(adId, adName || adId);
    }
    const nameKey = normalizeCreativeKey(adName);
    if (nameKey && adId && !byAdName.has(nameKey)) {
      byAdName.set(nameKey, { adId, adName: adName || adId });
    }
  }
  return { byAdId, byAdName };
}

export async function getInsightsData(
  fromISO: string,
  toISO: string,
  orgId: string,
  sources?: string[]
): Promise<{ metrics: InsightsMetrics; sources: string[] }> {
  const [leads, spendByCreative, knownAds, allSources] = await Promise.all([
    listAllLeads(orgId, sources),
    getMetaSpendByCreative(fromISO, toISO, orgId),
    listKnownAdsIndex(orgId),
    listDistinctLeadSources(orgId)
  ]);

  return {
    metrics: computeInsights(leads, spendByCreative, knownAds, fromISO, toISO),
    sources: allSources
  };
}
