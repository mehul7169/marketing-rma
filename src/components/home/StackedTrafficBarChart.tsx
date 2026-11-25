"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { chartAnimation } from "@/lib/motion";
import { readChartTheme } from "@/lib/ui/chartTheme";
import { formatChartDateLabel, getChartTickInterval } from "@/lib/utils/date";
import { formatCalendarDate } from "@/lib/timezone";
import type { TrendPoint } from "@/lib/home/metrics";
import type { TrendBucket } from "@/lib/home/range";
import { formatInteger } from "@/lib/format";

function bucketLabel(date: string, bucket: TrendBucket): string {
  if (bucket === "month") {
    const [y, m] = date.split("-");
    if (!y || !m) return date;
    return formatCalendarDate(`${y}-${m}-01`, "MMM yyyy");
  }
  return formatChartDateLabel(date);
}

function TrafficTooltip({
  active,
  payload,
  label,
  bucket
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: unknown }>;
  label?: string;
  bucket: TrendBucket;
}) {
  if (!active || !payload?.length || !label) return null;
  const paid = Number(payload.find((p) => p.dataKey === "paid")?.value ?? 0);
  const organic = Number(payload.find((p) => p.dataKey === "organic")?.value ?? 0);
  return (
    <div className="rounded-control border border-subtle bg-surface-2 px-3 py-2 text-xs text-fg shadow-card">
      <div className="font-medium">{bucketLabel(label, bucket)}</div>
      <div className="mt-1 text-muted">Paid {formatInteger(paid)}</div>
      <div className="text-muted">Organic {formatInteger(organic)}</div>
      <div className="mt-1 font-medium">Total {formatInteger(paid + organic)}</div>
    </div>
  );
}

export default function StackedTrafficBarChart({
  data,
  bucket
}: {
  data: TrendPoint[];
  bucket: TrendBucket;
}) {
  const motion = chartAnimation(useReducedMotion());
  const theme = useMemo(() => readChartTheme(), []);
  const tickInterval = getChartTickInterval(data.length);

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: theme.axis }}
            tickFormatter={(v: string) => bucketLabel(v, bucket)}
            interval={tickInterval}
            minTickGap={12}
          />
          <YAxis
            tick={{ fontSize: 11, fill: theme.axis }}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            content={<TrafficTooltip bucket={bucket} />}
          />
          <Bar
            dataKey="paid"
            name="Paid"
            stackId="traffic"
            fill={theme.series1}
            isAnimationActive={motion.isAnimationActive}
            animationDuration={motion.animationDuration}
          />
          <Bar
            dataKey="organic"
            name="Organic"
            stackId="traffic"
            fill={theme.series2}
            isAnimationActive={motion.isAnimationActive}
            animationDuration={motion.animationDuration}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
