import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { getOrgMetaAdAccountIds } from "@/lib/ad-accounts/getRmaAccountId";
import { listAllLeads, listDistinctLeadSources } from "@/lib/db/leads";
import {
  computeInsights,
  normalizeCreativeKey,
  type InsightsMetrics
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

/** Spend for Insights creative table — all active org ad accounts. */
export async function getMetaSpendByAdName(
  fromISO: string,
  toISO: string,
  orgId: string
): Promise<Map<string, { displayName: string; spend: number }>> {
  const map = new Map<string, { displayName: string; spend: number }>();
  if (!supabaseAdmin) return map;
  const accountIds = await getOrgMetaAdAccountIds(orgId);
  if (accountIds.length === 0) return map;

  // Filter by ad_account_id only — historical rows may carry a stale org_id.
  const rows = await paginate<{ ad_name: string | null; spend: unknown }>((from, to) =>
    supabaseAdmin!
      .from("meta_ads_daily")
      .select("ad_name, spend")
      .in("ad_account_id", accountIds)
      .gte("date", fromISO)
      .lte("date", toISO)
      .range(from, to)
  );

  for (const row of rows) {
    const key = normalizeCreativeKey(row.ad_name);
    if (!key) continue;
    const existing = map.get(key);
    const spend = num(row.spend);
    if (existing) {
      existing.spend += spend;
    } else {
      map.set(key, { displayName: row.ad_name!.trim(), spend });
    }
  }
  return map;
}

export async function listKnownAdNames(orgId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabaseAdmin) return map;
  const accountIds = await getOrgMetaAdAccountIds(orgId);
  if (accountIds.length === 0) return map;

  // Filter by ad_account_id only — historical rows may carry a stale org_id.
  const rows = await paginate<{ ad_name: string | null }>((from, to) =>
    supabaseAdmin!
      .from("meta_ads_daily")
      .select("ad_name")
      .in("ad_account_id", accountIds)
      .not("ad_name", "is", null)
      .range(from, to)
  );

  for (const row of rows) {
    const key = normalizeCreativeKey(row.ad_name);
    if (!key || map.has(key)) continue;
    map.set(key, row.ad_name!.trim());
  }
  return map;
}

export async function getInsightsData(
  fromISO: string,
  toISO: string,
  orgId: string,
  sources?: string[]
): Promise<{ metrics: InsightsMetrics; sources: string[] }> {
  const [leads, spendByAdName, knownAdNames, allSources] = await Promise.all([
    listAllLeads(orgId, sources),
    getMetaSpendByAdName(fromISO, toISO, orgId),
    listKnownAdNames(orgId),
    listDistinctLeadSources(orgId)
  ]);

  return {
    metrics: computeInsights(leads, spendByAdName, knownAdNames, fromISO, toISO),
    sources: allSources
  };
}
