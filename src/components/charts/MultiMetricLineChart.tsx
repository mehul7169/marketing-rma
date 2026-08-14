"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatChartDateLabel } from "@/lib/utils/date";

type TickFormatter = (value: number) => string;
type TooltipFormatter = (value: number) => string;

export type LineSeries = {
  dataKey: string;
  label: string;
  color: string;
};

export default function MultiMetricLineChart<
  T extends Record<string, unknown> & { date: string }
>({
  data,
  series,
  yAxisFormatter,
  tooltipFormatter,
  tickInterval = 0
}: {
  data: T[];
  series: LineSeries[];
  yAxisFormatter?: TickFormatter;
  tooltipFormatter?: TooltipFormatter;
  tickInterval?: number;
}) {
  const formatValue = tooltipFormatter ?? ((v: number) => v.toLocaleString("en-IN"));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={formatChartDateLabel}
            interval={tickInterval}
            minTickGap={12}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            width={yAxisFormatter ? 56 : 40}
            tickFormatter={yAxisFormatter}
          />
          <Tooltip
            labelFormatter={formatChartDateLabel}
            formatter={(value: unknown, name: unknown) => {
              const formatted =
                typeof value === "number" ? formatValue(value) : (value as never);
              return [formatted, name as string];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={data.length <= 14}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
