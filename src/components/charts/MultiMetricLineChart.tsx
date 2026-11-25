"use client";

import { useReducedMotion } from "motion/react";
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
import { chartAnimation } from "@/lib/motion";
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
  const motion = chartAnimation(useReducedMotion());

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickFormatter={formatChartDateLabel}
            interval={tickInterval}
            minTickGap={12}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            width={yAxisFormatter ? 56 : 40}
            tickFormatter={yAxisFormatter}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: 10
            }}
            labelFormatter={formatChartDateLabel}
            formatter={(value: unknown, name: unknown) => {
              const formatted =
                typeof value === "number" ? formatValue(value) : (value as never);
              return [formatted, name as string];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            content={({ payload }) => (
              <ul className="flex flex-wrap justify-center gap-4 pt-1 text-xs text-fg">
                {(payload ?? []).map((p) => (
                  <li
                    key={String(p.value)}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: p.color }}
                      aria-hidden
                    />
                    <span>{p.value}</span>
                  </li>
                ))}
              </ul>
            )}
          />
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
              isAnimationActive={motion.isAnimationActive}
              animationDuration={motion.animationDuration}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
