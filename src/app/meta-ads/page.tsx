import { addDaysISO, clampDateRange, toISODate } from "@/lib/utils/date";
import {
  getMetaAdsAggregatedTable,
  getMetaAdsTotals,
  getMetaAdsTrend
} from "@/lib/db/meta_ads_daily";
import DateRangePicker from "@/components/DateRangePicker";
import TwoMetricLineChart from "@/components/charts/TwoMetricLineChart";
import MetaAdsTable from "@/components/meta/MetaAdsTable";

function fmtMoney(v: number | null) {
  if (v === null) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default async function MetaAdsPage({
  searchParams
}: {
  searchParams: { from?: string; to?: string };
}) {
  const hasCustomRange = Boolean(searchParams.from || searchParams.to);
  const todayISO = toISODate(new Date());
  const fallbackTo = todayISO;
  const fallbackFrom = addDaysISO(todayISO, -29);

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

  const [totals, trend, table] = await Promise.all([
    getMetaAdsTotals(fromISO, toISO),
    getMetaAdsTrend(fromISO, toISO),
    getMetaAdsAggregatedTable(fromISO, toISO)
  ]);

  const hasAnyData = trend.length > 0 || table.length > 0;

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
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-slate-200 p-5">
              <div className="text-xs text-slate-600">Total Spend</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                ${totals.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded border border-slate-200 p-5">
              <div className="text-xs text-slate-600">Total Leads</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {totals.totalLeads.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-slate-200 p-5">
              <div className="text-xs text-slate-600">Blended Cost / Lead</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {totals.blendedCostPerLead === null
                  ? "—"
                  : `$${fmtMoney(totals.blendedCostPerLead)}`}
              </div>
            </div>
            <div className="rounded border border-slate-200 p-5">
              <div className="text-xs text-slate-600">Average CTR%</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {totals.averageCtrPercent.toLocaleString(undefined, {
                  maximumFractionDigits: 2
                })}
                %
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-900">Trends</h2>
            <div className="rounded border border-slate-200 p-4">
              <TwoMetricLineChart
                data={trend}
                metricA={{ key: "spend", label: "Spend", color: "#1d4ed8" }}
                metricB={{ key: "leads", label: "Leads", color: "#0284c7" }}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-900">
              Campaign / Ad Set (aggregated)
            </h2>
            <MetaAdsTable rows={table} />
            <div className="text-xs text-slate-500">
              Tip: click any numeric column header to sort.
            </div>
          </section>
        </>
      )}
    </div>
  );
}

