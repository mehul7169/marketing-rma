"use client";

import type { InsightsDailyPoint } from "@/lib/insights/metrics";
import MultiMetricLineChart from "@/components/charts/MultiMetricLineChart";
import { formatInteger } from "@/lib/format";
import { formatCalendarDate } from "@/lib/timezone";
import { getChartTickInterval } from "@/lib/utils/date";

const MIN_TREND_DAYS = 3;

const SERIES = [
  { dataKey: "callsBooked", label: "Calls booked", color: "#1d4ed8" },
  { dataKey: "showUpCalls", label: "Show-up calls", color: "#0284c7" },
  { dataKey: "dealsClosed", label: "Deals closed", color: "#059669" }
];

export default function InsightsTrendSection({
  trend,
  rangeDays
}: {
  trend: InsightsDailyPoint[];
  rangeDays: number;
}) {
  const tickInterval = getChartTickInterval(rangeDays);
  const daysWithData = trend.filter(
    (d) => d.callsBooked > 0 || d.showUpCalls > 0 || d.dealsClosed > 0
  ).length;

  if (daysWithData < MIN_TREND_DAYS) {
    const rows = trend.filter(
      (d) => d.callsBooked > 0 || d.showUpCalls > 0 || d.dealsClosed > 0
    );
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Not enough data yet to show a trend — check back once more days have
          been pulled in.
        </p>
        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-700">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Calls booked</th>
                  <th className="px-4 py-2 text-right font-medium">Show-up calls</th>
                  <th className="px-4 py-2 text-right font-medium">Deals closed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <tr key={row.date}>
                    <td className="px-4 py-2 text-slate-900">
                      {formatCalendarDate(row.date, "d MMM yyyy")}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatInteger(row.callsBooked)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatInteger(row.showUpCalls)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatInteger(row.dealsClosed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <MultiMetricLineChart
      data={trend}
      series={SERIES}
      tooltipFormatter={formatInteger}
      tickInterval={tickInterval}
    />
  );
}
