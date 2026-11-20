import { getCurrentSession } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { getLatestCronRunForJob } from "@/lib/db/cron_runs";
import { getMembershipRole } from "@/lib/db/memberships";
import { getOrgMetaAdAccountIds } from "@/lib/ad-accounts/getRmaAccountId";
import { clipError, isMetaTokenExpiry } from "@/lib/cron/reportCronResult";
import { addIstCalendarDays, formatIST, todayISTDateString } from "@/lib/timezone";

export type MetaAdsHealth = {
  failing: boolean;
  failingSince: string | null;
  lastError: string | null;
  stale: boolean;
  lastDataDate: string | null;
};

const STALE_AFTER_DAYS = 2;

export function isMetaAdsDataStale(
  lastDataDate: string | null,
  todayISO: string = todayISTDateString()
): boolean {
  if (!lastDataDate) return true;
  return lastDataDate < addIstCalendarDays(todayISO, -STALE_AFTER_DAYS);
}

export async function latestMetaAdsDate(accountIds: string[]): Promise<string | null> {
  if (!supabaseAdmin || accountIds.length === 0) return null;
  const { data, error } = await supabaseAdmin
    .from("meta_ads_daily")
    .select("date")
    .in("ad_account_id", accountIds)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.date ? String(data.date) : null;
}

async function failingSinceForJob(job: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data: lastOk, error: okErr } = await supabaseAdmin
    .from("cron_runs")
    .select("ran_at")
    .eq("job", job)
    .eq("status", "success")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (okErr) throw okErr;
  let query = supabaseAdmin
    .from("cron_runs")
    .select("ran_at")
    .eq("job", job)
    .eq("status", "error")
    .order("ran_at", { ascending: true })
    .limit(1);
  if (lastOk?.ran_at) query = query.gt("ran_at", String(lastOk.ran_at));
  const { data: firstFail, error: failErr } = await query.maybeSingle();
  if (failErr) throw failErr;
  return firstFail?.ran_at ? String(firstFail.ran_at) : null;
}

export async function getMetaAdsHealth(orgId: string): Promise<MetaAdsHealth> {
  const [latest, accountIds] = await Promise.all([
    getLatestCronRunForJob("meta-ads"),
    getOrgMetaAdAccountIds(orgId)
  ]);
  const failing = latest?.status === "error";
  const [lastDataDate, failingSince] = await Promise.all([
    latestMetaAdsDate(accountIds),
    failing ? failingSinceForJob("meta-ads") : Promise.resolve(null)
  ]);
  return {
    failing,
    failingSince: failing ? failingSince ?? latest?.ran_at ?? null : null,
    lastError: failing ? latest?.error ?? null : null,
    stale: isMetaAdsDataStale(lastDataDate),
    lastDataDate
  };
}

export async function currentUserCanSeeOpsBanners(orgId: string): Promise<boolean> {
  const session = await getCurrentSession();
  if (!session) return false;
  const [role, platform] = await Promise.all([
    getMembershipRole(session.userId, orgId),
    isPlatformAdmin()
  ]);
  return role === "admin" || platform;
}

export function metaAdsHealthBannerText(h: MetaAdsHealth): string | null {
  if (!h.failing && !h.stale) return null;
  const since = h.failingSince ? formatIST(h.failingSince, "d MMM") : null;
  if (h.failing) {
    const start = since
      ? `Meta Ads sync has been failing since ${since}.`
      : "Meta Ads sync is failing.";
    if (isMetaTokenExpiry(h.lastError)) {
      return `${start} Meta access token expired. Reconnect with a long-lived token.`;
    }
    const err = clipError(h.lastError, 180);
    return err ? `${start} Last error: ${err}` : start;
  }
  const last = h.lastDataDate ?? "unknown";
  return `Meta Ads data is more than 2 days old (last day ${last}). Spend and CPL may be frozen.`;
}
