import { addDaysISO, clampDateRange, toISODate } from "@/lib/utils/date";
import {
  getWebsiteDailyTable,
  getWebsiteTotals,
  getWebsiteTrend
} from "@/lib/db/website_daily";
import DateRangePicker from "@/components/DateRangePicker";
import TwoMetricLineChart from "@/components/charts/TwoMetricLineChart";
import WebsiteDailyTable from "@/components/website/WebsiteDailyTable";

function fmtMaybePct(v: number | null) {
  if (v === null) return "—";
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export default async function WebsitePage({
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
    // Graceful fallback
  }

  const [totals, trend, daily] = await Promise.all([
    getWebsiteTotals(fromISO, toISO),
    getWebsiteTrend(fromISO, toISO),
    getWebsiteDailyTable(fromISO, toISO)
  ]);

  const hasAnyData = daily.length > 0 || trend.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Website & Video Analytics
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

      {/* TODO (phase 2): GA4 currently doesn't capture UTM source/campaign into GA4.
          When you wire GA4 to start populating `website_daily.lead_source` and
          `website_daily.utm_campaign`, add a toggle to break down charts/tables
          by source + campaign. */}
      <div className="flex items-center gap-3">
        <input type="checkbox" disabled checked className="h-4 w-4" />
        <div className="text-xs text-slate-500">
          Break down by source (disabled until GA4 captures UTMs)
        </div>
      </div>

      {!hasAnyData ? (
        <div className="rounded border border-slate-200 p-10 text-center text-sm text-slate-600">
          No data in this date range yet.
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-slate-200 p-5">
              <div className="text-xs text-slate-600">Landing Page Visits</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {totals.totalLandingPageVisits.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-slate-200 p-5">
              <div className="text-xs text-slate-600">Video Plays</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {totals.totalVideoPlays.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-slate-200 p-5">
              <div className="text-xs text-slate-600">Average Watch %</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {fmtMaybePct(totals.averageWatchPercent)}
              </div>
            </div>
            <div className="rounded border border-slate-200 p-5">
              <div className="text-xs text-slate-600">Form Completion Rate</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {totals.formCompletionRatePercent === null
                  ? "—"
                  : fmtMaybePct(totals.formCompletionRatePercent)}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-900">Trends</h2>
            <div className="rounded border border-slate-200 p-4">
              <TwoMetricLineChart
                data={trend}
                metricA={{
                  key: "landing_page_visits",
                  label: "Landing Page Visits",
                  color: "#1d4ed8"
                }}
                metricB={{
                  key: "video_plays",
                  label: "Video Plays",
                  color: "#0284c7"
                }}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-900">Daily</h2>
            <WebsiteDailyTable rows={daily} />
          </section>
        </>
      )}
    </div>
  );
}

