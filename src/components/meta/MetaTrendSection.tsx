"use client";

import type { MetaAdsTrendPoint } from "@/lib/db/meta_ads_daily";
import SingleMetricLineChart from "@/components/charts/SingleMetricLineChart";
import {
  formatCurrency,
  formatCurrencyAxis,
  formatInteger
} from "@/lib/format";
import { formatCalendarDate } from "@/lib/timezone";
import { getChartTickInterval } from "@/lib/utils/date";

const MIN_TREND_DAYS = 3;

export default function MetaTrendSection({
  trend,
  rangeDays
}: {
  trend: MetaAdsTrendPoint[];
  rangeDays: number;
}) {
  const tickInterval = getChartTickInterval(rangeDays);
  const daysWithData = trend.filter((d) => d.spend > 0 || d.leads > 0).length;

  if (daysWithData < MIN_TREND_DAYS) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Not enough data yet to show a trend — check back once more days have
          been pulled in.
        </p>
        {trend.filter((d) => d.spend > 0 || d.leads > 0).length > 0 && (
          <div className="overflow-x-auto rounded border border-subtle">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-fg">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Spend</th>
                  <th className="px-4 py-2 text-right font-medium">Leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {trend
                  .filter((d) => d.spend > 0 || d.leads > 0)
                  .map((row) => (
                  <tr key={row.date}>
                    <td className="px-4 py-2 text-fg">
                      {formatCalendarDate(row.date, "d MMM yyyy")}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatCurrency(row.spend)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatInteger(row.leads)}
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
        <h3 className="mb-2 text-xs font-medium text-muted">
          Spend over time
        </h3>
        <SingleMetricLineChart
          data={trend}
          dataKey="spend"
          label="Spend"
          color="var(--accent)"
          yAxisFormatter={formatCurrencyAxis}
          tooltipFormatter={formatCurrency}
          tickInterval={tickInterval}
        />
      </div>
      <div>
        <h3 className="mb-2 text-xs font-medium text-muted">
          Leads over time
        </h3>
        <SingleMetricLineChart
          data={trend}
          dataKey="leads"
          label="Leads"
          color="var(--neutral-series)"
          tooltipFormatter={formatInteger}
          tickInterval={tickInterval}
        />
      </div>
    </div>
  );
}
