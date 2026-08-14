"use client";

import type { WebsiteTrendPoint } from "@/lib/db/website_daily";
import SingleMetricLineChart from "@/components/charts/SingleMetricLineChart";
import { formatInteger } from "@/lib/format";
import { formatCalendarDate } from "@/lib/timezone";
import { getChartTickInterval } from "@/lib/utils/date";

const MIN_TREND_DAYS = 3;

export default function WebsiteTrendSection({
  trend,
  rangeDays
}: {
  trend: WebsiteTrendPoint[];
  rangeDays: number;
}) {
  const tickInterval = getChartTickInterval(rangeDays);
  const daysWithData = trend.filter(
    (d) => d.landing_page_visits > 0 || d.video_plays > 0
  ).length;

  if (daysWithData < MIN_TREND_DAYS) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Not enough data yet to show a trend — check back once more days have
          been pulled in.
        </p>
        {trend.length > 0 && (
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-700">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Landing Page Visits
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Video Plays</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {trend
                  .filter((d) => d.landing_page_visits > 0 || d.video_plays > 0)
                  .map((row) => (
                    <tr key={row.date}>
                      <td className="px-4 py-2 text-slate-900">
                        {formatCalendarDate(row.date, "d MMM yyyy")}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatInteger(row.landing_page_visits)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatInteger(row.video_plays)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-medium text-slate-600">
          Landing page visits over time
        </h3>
        <SingleMetricLineChart
          data={trend}
          dataKey="landing_page_visits"
          label="Landing Page Visits"
          color="#1d4ed8"
          tooltipFormatter={formatInteger}
          tickInterval={tickInterval}
        />
      </div>
      <div>
        <h3 className="mb-2 text-xs font-medium text-slate-600">
          Video plays over time
        </h3>
        <SingleMetricLineChart
          data={trend}
          dataKey="video_plays"
          label="Video Plays"
          color="#0284c7"
          tooltipFormatter={formatInteger}
          tickInterval={tickInterval}
        />
      </div>
    </div>
  );
}
