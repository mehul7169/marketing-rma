import { unstable_cache } from "next/cache";
import { getOrgMetaAdAccountIds } from "@/lib/ad-accounts/getRmaAccountId";
import {
  assembleHomeDashboard,
  type HomeDashboard
} from "@/lib/home/assemble";
import type { HomeLead } from "@/lib/home/metrics";
import {
  istMonthEnd,
  istMonthStart,
  parseHomeRange,
  parseHomeTraffic,
  rangeToFromTo,
  type HomeRangeId,
  type HomeTrafficId
} from "@/lib/home/range";
import {
  getMetaAdsHealth,
  isMetaAdsDataStale
} from "@/lib/cron/metaAdsHealth";
import { getOrganizationById } from "@/lib/db/organizations";
import { getMetaAdsTotals } from "@/lib/db/meta_ads_daily";
import { getSetterActivityReport } from "@/lib/db/setterActivity";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { todayISTDateString } from "@/lib/timezone";

const PAGE = 1000;

const HOME_LEAD_SELECT = [
  "id",
  "created_at",
  "first_contacted_at",
  "qualified",
  "qualified_at",
  "form_qualified",
  "call_booked_at",
  "call_showed",
  "call_showed_at",
  "deal_closed",
  "deal_value",
  "closed_at",
  "lead_source",
  "utm_medium",
  "utm_campaign",
  "owner_id"
].join(",");

function asHomeLead(row: Record<string, unknown>): HomeLead {
  const rawValue = row.deal_value;
  return {
    id: String(row.id ?? ""),
    created_at: String(row.created_at ?? ""),
    first_contacted_at: (row.first_contacted_at as string | null) ?? null,
    qualified: (row.qualified as boolean | null) ?? null,
    qualified_at: (row.qualified_at as string | null) ?? null,
    form_qualified: (row.form_qualified as boolean | null) ?? null,
    call_booked_at: (row.call_booked_at as string | null) ?? null,
    call_showed: (row.call_showed as boolean | null) ?? null,
    call_showed_at: (row.call_showed_at as string | null) ?? null,
    deal_closed: (row.deal_closed as boolean | null) ?? null,
    deal_value:
      rawValue === null || rawValue === undefined || rawValue === ""
        ? null
        : Number(rawValue),
    closed_at: (row.closed_at as string | null) ?? null,
    lead_source: (row.lead_source as string | null) ?? null,
    utm_medium: (row.utm_medium as string | null) ?? null,
    utm_campaign: (row.utm_campaign as string | null) ?? null,
    owner_id: (row.owner_id as string | null) ?? null
  };
}

export async function listHomeLeads(orgId: string): Promise<HomeLead[]> {
  if (!supabaseAdmin) return [];
  const rows: HomeLead[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select(HOME_LEAD_SELECT)
      .eq("org_id", orgId)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of batch) rows.push(asHomeLead(row));
    if (batch.length < PAGE) break;
  }
  return rows;
}

async function profileEmails(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabaseAdmin || userIds.length === 0) return map;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .in("id", userIds);
  if (error) throw error;
  for (const p of data ?? []) {
    const row = p as { id: string; email: string | null };
    if (row.email) map.set(row.id, row.email);
  }
  return map;
}

async function computeHomeDashboard(
  orgId: string,
  range: HomeRangeId,
  traffic: HomeTrafficId,
  todayISO: string
): Promise<HomeDashboard> {
  const { fromISO, toISO } = rangeToFromTo(range, todayISO);
  const monthStart = istMonthStart(todayISO);
  const monthEnd = istMonthEnd(todayISO);

  const [leads, org, setters, adsTotals, health, accountIds] = await Promise.all([
    listHomeLeads(orgId),
    getOrganizationById(orgId),
    getSetterActivityReport(orgId, fromISO, toISO),
    getMetaAdsTotals(fromISO, toISO, orgId),
    getMetaAdsHealth(orgId),
    getOrgMetaAdAccountIds(orgId)
  ]);

  const ownerIds = Array.from(
    new Set(
      leads.map((l) => l.owner_id).filter((id): id is string => Boolean(id))
    )
  );
  const closerLabels = await profileEmails(ownerIds);
  const hasAdsAccount = accountIds.length > 0;
  const stale = hasAdsAccount && isMetaAdsDataStale(health.lastDataDate, todayISO);

  return assembleHomeDashboard({
    leads,
    range,
    traffic,
    todayISO,
    monthStart,
    monthEnd,
    monthlyTarget: org?.monthly_target ?? null,
    setters: setters.users,
    closerLabels,
    ads: hasAdsAccount
      ? {
          spend: adsTotals.totalSpend,
          stale,
          lastDataDate: health.lastDataDate
        }
      : null
  });
}

const cachedHomeDashboard = unstable_cache(
  computeHomeDashboard,
  ["home-dashboard"],
  { revalidate: 60 }
);

export async function loadHomeDashboard(opts: {
  orgId: string;
  range?: string | null;
  traffic?: string | null;
  todayISO?: string;
}): Promise<HomeDashboard> {
  const todayISO = opts.todayISO ?? todayISTDateString();
  const range = parseHomeRange(opts.range);
  const traffic = parseHomeTraffic(opts.traffic);
  return cachedHomeDashboard(opts.orgId, range, traffic, todayISO);
}
