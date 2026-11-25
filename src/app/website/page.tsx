import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import {
  clampDateRange,
  defaultFromISO,
  fillTrendDateGaps,
  inclusiveDayCount
} from "@/lib/utils/date";
import { todayISTDateString } from "@/lib/timezone";
import {
  getWebsiteDailyTable,
  getWebsiteTotals,
  getWebsiteTrend
} from "@/lib/db/website_daily";
import DateRangePicker from "@/components/DateRangePicker";
import WebsiteDailyTable from "@/components/website/WebsiteDailyTable";
import WebsiteTrendSection from "@/components/website/WebsiteTrendSection";
import { EnterStagger } from "@/components/ui/Enter";
import Stat from "@/components/ui/Stat";

export default async function WebsitePage({
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
    // Graceful fallback
  }

  const rangeDays = inclusiveDayCount(fromISO, toISO);
  const orgId = await getCurrentOrgId();

  const [totals, trendRaw, daily] = await Promise.all([
    getWebsiteTotals(fromISO, toISO, orgId),
    getWebsiteTrend(fromISO, toISO, orgId),
    getWebsiteDailyTable(fromISO, toISO, orgId)
  ]);

  const hasAnyData = daily.length > 0 || trendRaw.length > 0;

  const daysWithData = trendRaw.filter(
    (d) => d.landing_page_visits > 0 || d.video_plays > 0
  ).length;

  const trendForChart =
    daysWithData >= 3
      ? fillTrendDateGaps(trendRaw, fromISO, toISO, {
          landing_page_visits: 0,
          video_plays: 0
        })
      : trendRaw;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">
            Website & Video Analytics
          </h1>
          <p className="mt-1 text-sm text-muted">
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
        <div className="text-xs text-muted">
          Break down by source (disabled until GA4 captures UTMs)
        </div>
      </div>

      {!hasAnyData ? (
        <div className="rounded border border-subtle p-10 text-center text-sm text-muted">
          No data in this date range yet.
        </div>
      ) : (
        <>
          <EnterStagger id="website-kpis" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="stat-card">
              <Stat
                label="Landing Page Visits"
                value={totals.totalLandingPageVisits}
                format="integer"
                size="md"
              />
            </div>
            <div className="stat-card">
              <Stat
                label="Video Plays"
                value={totals.totalVideoPlays}
                format="integer"
                size="md"
              />
            </div>
            <div className="stat-card">
              <Stat
                label="Average Watch %"
                value={
                  totals.averageWatchPercent === null
                    ? "—"
                    : totals.averageWatchPercent
                }
                format="percent"
                size="md"
              />
            </div>
            <div className="stat-card">
              <Stat
                label="Form Completion Rate"
                value={
                  totals.formCompletionRatePercent === null
                    ? "—"
                    : totals.formCompletionRatePercent
                }
                format="percent"
                size="md"
              />
            </div>
          </EnterStagger>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-fg">Trends</h2>
            <div className="rounded border border-subtle p-4">
              <WebsiteTrendSection trend={trendForChart} rangeDays={rangeDays} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-fg">Daily</h2>
            <WebsiteDailyTable rows={daily} />
          </section>
        </>
      )}
    </div>
  );
}
