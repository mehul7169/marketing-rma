"use client";

import { useReducedMotion } from "motion/react";
import {
  CartesianGrid,
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

export default function SingleMetricLineChart<
  T extends Record<string, unknown> & { date: string }
>({
  data,
  dataKey,
  label,
  color,
  yAxisFormatter,
  tooltipFormatter,
  tickInterval = 0
}: {
  data: T[];
  dataKey: keyof T & string;
  label: string;
  color: string;
  yAxisFormatter?: TickFormatter;
  tooltipFormatter?: TooltipFormatter;
  tickInterval?: number;
}) {
  const formatValue = tooltipFormatter ?? ((v: number) => v.toLocaleString("en-IN"));
  const motion = chartAnimation(useReducedMotion());

  return (
    <div className="h-52 w-full">
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
            formatter={(value: unknown) => {
              if (typeof value === "number") return formatValue(value);
              return value as never;
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke={color}
            strokeWidth={2}
            dot={data.length <= 14}
            activeDot={{ r: 4 }}
            isAnimationActive={motion.isAnimationActive}
            animationDuration={motion.animationDuration}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
