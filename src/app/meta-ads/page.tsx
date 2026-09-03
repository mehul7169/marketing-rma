import {
  clampDateRange,
  defaultFromISO,
  fillTrendDateGaps,
  getPriorPeriod,
  inclusiveDayCount,
  isCohortImmature
} from "@/lib/utils/date";
import { todayISTDateString } from "@/lib/timezone";
import {
  getMetaAdsHierarchy,
  getMetaAdsTotals,
  getMetaAdsTrend
} from "@/lib/db/meta_ads_daily";
import { listKnownAdNames } from "@/lib/db/insights";
import { listLeadsInRange } from "@/lib/db/leads";
import { attachMetaFunnelOutcomes } from "@/lib/meta/funnelOutcomes";
import CohortMaturityNote from "@/components/CohortMaturityNote";
import DateRangePicker from "@/components/DateRangePicker";
import MetaAdsTable from "@/components/meta/MetaAdsTable";
import MetaSummaryCards from "@/components/meta/MetaSummaryCards";
import MetaTrendSection from "@/components/meta/MetaTrendSection";

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

  const [totals, priorTotals, trendRaw, hierarchy, cohortLeads, knownAdNames] =
    await Promise.all([
      getMetaAdsTotals(fromISO, toISO),
      getMetaAdsTotals(priorPeriod.fromISO, priorPeriod.toISO),
      getMetaAdsTrend(fromISO, toISO),
      getMetaAdsHierarchy(fromISO, toISO),
      listLeadsInRange(fromISO, toISO),
      listKnownAdNames()
    ]);

  const { campaigns: table, unmatchedLeadCount } = attachMetaFunnelOutcomes(
    hierarchy,
    cohortLeads,
    knownAdNames,
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
          <h1 className="page-title">
            Meta Ads Performance
          </h1>
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

      {!hasAnyData ? (
        <div className="rounded border border-slate-200 p-10 text-center text-sm text-slate-600">
          No data in this date range yet.
        </div>
      ) : (
        <>
          <MetaSummaryCards
            totals={totals}
            priorTotals={priorHasData ? priorTotals : null}
            periodDays={priorPeriod.periodDays}
          />

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-900">Trends</h2>
            <div className="rounded border border-slate-200 p-4">
              <MetaTrendSection trend={trendForChart} rangeDays={rangeDays} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-900">Campaigns</h2>
            {immature ? <CohortMaturityNote /> : null}
            <MetaAdsTable rows={table} unmatchedLeadCount={unmatchedLeadCount} />
            <div className="text-xs text-slate-500">
              Click a row to expand ad sets, then ads. Sort applies at every level.
              Funnel columns are cohort-based (leads created in this range, matched by
              utm_content → ad name).
            </div>
          </section>
        </>
      )}
    </div>
  );
}
