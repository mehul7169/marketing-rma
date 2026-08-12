"use client";

import type { MetaAdsTrendPoint } from "@/lib/db/meta_ads_daily";
import SingleMetricLineChart from "@/components/charts/SingleMetricLineChart";
import {
  formatCurrency,
  formatCurrencyAxis,
  formatInteger
} from "@/lib/format";
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
        <p className="text-sm text-slate-600">
          Not enough data yet to show a trend — check back once more days have
          been pulled in.
        </p>
        {trend.filter((d) => d.spend > 0 || d.leads > 0).length > 0 && (
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-700">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Spend</th>
                  <th className="px-4 py-2 text-right font-medium">Leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {trend
                  .filter((d) => d.spend > 0 || d.leads > 0)
                  .map((row) => (
                  <tr key={row.date}>
                    <td className="px-4 py-2 text-slate-900">{row.date}</td>
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
        <h3 className="mb-2 text-xs font-medium text-slate-600">
          Spend over time
        </h3>
        <SingleMetricLineChart
          data={trend}
          dataKey="spend"
          label="Spend"
          color="#1d4ed8"
          yAxisFormatter={formatCurrencyAxis}
          tooltipFormatter={formatCurrency}
          tickInterval={tickInterval}
        />
      </div>
      <div>
        <h3 className="mb-2 text-xs font-medium text-slate-600">
          Leads over time
        </h3>
        <SingleMetricLineChart
          data={trend}
          dataKey="leads"
          label="Leads"
          color="#0284c7"
          tooltipFormatter={formatInteger}
          tickInterval={tickInterval}
        />
      </div>
    </div>
  );
}
