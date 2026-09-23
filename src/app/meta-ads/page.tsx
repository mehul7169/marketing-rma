import {
  clampDateRange,
  defaultFromISO,
  fillTrendDateGaps,
  getPriorPeriod,
  inclusiveDayCount,
  isCohortImmature
} from "@/lib/utils/date";
import { todayISTDateString } from "@/lib/timezone";
import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import { getOrgMetaAdAccountIds } from "@/lib/ad-accounts/getRmaAccountId";
import {
  getMetaAdsHierarchy,
  getMetaAdsTotals,
  getMetaAdsTrend
} from "@/lib/db/meta_ads_daily";
import { listKnownAdsIndex } from "@/lib/db/insights";
import { listLeadsInRange } from "@/lib/db/leads";
import { attachMetaFunnelOutcomes } from "@/lib/meta/funnelOutcomes";
import DateRangePicker from "@/components/DateRangePicker";
import MetaPerformanceDashboard from "@/components/meta/MetaPerformanceDashboard";

export default async function MetaAdsPage({
  searchParams
}: {
  searchParams: { from?: string; to?: string };
}) {
  const hasCustomRange = Boolean(searchParams.from || searchParams.to);
  const todayISO = todayISTDateString();
  const fallbackTo = todayISO;
  const fallbackFrom = defaultFromISO(todayISO);

  let fromISO = fallbackFrom;
  let toISO = fallbackTo;

  try {
    if (searchParams.from && searchParams.to) {
      const clamped = clampDateRange(searchParams.from, searchParams.to);
      fromISO = clamped.fromISO;
      toISO = clamped.toISO;
    }
  } catch {
    // Graceful fallback to default range.
  }

  const priorPeriod = getPriorPeriod(fromISO, toISO);
  const rangeDays = inclusiveDayCount(fromISO, toISO);
  const immature = isCohortImmature(toISO, todayISO);

  const orgId = await getCurrentOrgId();
  const accountIds = await getOrgMetaAdAccountIds(orgId);
  const hasAccounts = accountIds.length > 0;

  const [totals, priorTotals, trendRaw, hierarchy, cohortLeads, knownAds] =
    hasAccounts
      ? await Promise.all([
          getMetaAdsTotals(fromISO, toISO, orgId, accountIds),
          getMetaAdsTotals(priorPeriod.fromISO, priorPeriod.toISO, orgId, accountIds),
          getMetaAdsTrend(fromISO, toISO, orgId, accountIds),
          getMetaAdsHierarchy(fromISO, toISO, orgId, accountIds),
          listLeadsInRange(fromISO, toISO, orgId),
          listKnownAdsIndex(orgId)
        ])
      : [
          {
            totalSpend: 0,
            totalLeads: 0,
            blendedCostPerLead: null as number | null,
            averageCtrPercent: 0
          },
          {
            totalSpend: 0,
            totalLeads: 0,
            blendedCostPerLead: null as number | null,
            averageCtrPercent: 0
          },
          [] as Awaited<ReturnType<typeof getMetaAdsTrend>>,
          [] as Awaited<ReturnType<typeof getMetaAdsHierarchy>>,
          [] as Awaited<ReturnType<typeof listLeadsInRange>>,
          { byAdId: new Map(), byAdName: new Map() }
        ];

  const { campaigns: table, unmatchedLeadCount } = attachMetaFunnelOutcomes(
    hierarchy,
    cohortLeads,
    knownAds,
    fromISO,
    toISO
  );

  const hasAnyData = trendRaw.length > 0 || table.length > 0;

  const daysWithData = trendRaw.filter((d) => d.spend > 0 || d.leads > 0).length;

  const trendForChart =
    daysWithData >= 3
      ? fillTrendDateGaps(trendRaw, fromISO, toISO, { spend: 0, leads: 0, clicks: 0 })
      : trendRaw;

  const priorHasData =
    priorTotals.totalSpend > 0 ||
    priorTotals.totalLeads > 0 ||
    priorTotals.averageCtrPercent > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Meta Ads Performance</h1>
          <p className="mt-1 text-sm text-slate-600">
            {fromISO} to {toISO}
          </p>
        </div>
        <DateRangePicker
          fromISO={fromISO}
          toISO={toISO}
          hasCustomRange={hasCustomRange}
        />
      </div>

      {!hasAccounts ? (
        <div className="rounded border border-slate-200 p-10 text-center text-sm text-slate-600">
          No lead-source ad account configured for this organization in
          ad_accounts.
        </div>
      ) : !hasAnyData ? (
        <div className="rounded border border-slate-200 p-10 text-center text-sm text-slate-600">
          No data in this date range yet.
        </div>
      ) : (
        <MetaPerformanceDashboard
          mode="lead-source"
          totals={totals}
          priorTotals={priorHasData ? priorTotals : null}
          periodDays={priorPeriod.periodDays}
          trend={trendForChart}
          rangeDays={rangeDays}
          campaigns={table}
          unmatchedLeadCount={unmatchedLeadCount}
          immature={immature}
        />
      )}
    </div>
  );
}
