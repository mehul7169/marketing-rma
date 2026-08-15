import {
  clampDateRange,
  defaultFromISO,
  fillTrendDateGaps,
  getPriorPeriod,
  inclusiveDayCount
} from "@/lib/utils/date";
import { todayISTDateString } from "@/lib/timezone";
import {
  getMetaAdsHierarchy,
  getMetaAdsTotals,
  getMetaAdsTrend
} from "@/lib/db/meta_ads_daily";
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

  const [totals, priorTotals, trendRaw, table] = await Promise.all([
    getMetaAdsTotals(fromISO, toISO),
    getMetaAdsTotals(priorPeriod.fromISO, priorPeriod.toISO),
    getMetaAdsTrend(fromISO, toISO),
    getMetaAdsHierarchy(fromISO, toISO)
  ]);

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
          <h1 className="text-lg font-semibold text-slate-900">
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
            <h2 className="text-sm font-medium text-slate-900">
              Campaigns
            </h2>
            <MetaAdsTable rows={table} />
            <div className="text-xs text-slate-500">
              Click a row to expand ad sets, then ads. Sort applies at every level.
            </div>
          </section>
        </>
      )}
    </div>
  );
}
