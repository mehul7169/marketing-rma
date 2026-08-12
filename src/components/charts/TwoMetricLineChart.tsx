"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export default function TwoMetricLineChart<
  T extends Record<string, unknown> & { date: string }
>({
  data,
  metricA,
  metricB
}: {
  data: T[];
  metricA: { key: keyof T; label: string; color: string };
  metricB: { key: keyof T; label: string; color: string };
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: unknown) => {
              if (typeof value === "number") return value.toLocaleString();
              return value as never;
            }}
          />
          <Line
            type="monotone"
            dataKey={metricA.key as string}
            name={metricA.label}
            stroke={metricA.color}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey={metricB.key as string}
            name={metricB.label}
            stroke={metricB.color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

