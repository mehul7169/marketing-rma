"use client";

import type { ReactNode } from "react";
import CountUp from "@/components/ui/CountUp";
import { cn } from "@/components/ui/cn";
import {
  formatCurrency,
  formatInrCompact,
  formatInteger,
  formatPercent
} from "@/lib/format";

export type StatSize = "md" | "lg" | "xl";
export type StatFormatName =
  | "currency"
  | "compactInr"
  | "percent"
  | "integer"
  | "percent0";

const NAMED: Record<StatFormatName, (n: number) => string> = {
  currency: formatCurrency,
  compactInr: formatInrCompact,
  percent: formatPercent,
  integer: formatInteger,
  percent0: (n) => `${Math.round(n).toLocaleString("en-IN")}%`
};

const VALUE: Record<StatSize, string> = {
  md: "text-kpi",
  lg: "text-[2rem] font-bold leading-tight",
  xl: "text-display"
};

export default function Stat({
  label,
  value,
  format,
  delta,
  sub,
  size = "md",
  speed = "slow",
  className,
  valueTestId
}: {
  label: ReactNode;
  value: number | string;
  format?: StatFormatName | ((n: number) => string);
  delta?: { direction: "up" | "down" | "flat"; label: string };
  sub?: ReactNode;
  size?: StatSize;
  speed?: "slow" | "badge";
  className?: string;
  valueTestId?: string;
}) {
  const numeric = typeof value === "number";
  const fmt =
    typeof format === "string"
      ? NAMED[format]
      : (format ?? ((n: number) => String(Math.round(n))));
  const deltaColor =
    delta?.direction === "up"
      ? "text-success"
      : delta?.direction === "down"
        ? "text-danger"
        : "text-muted";
  const arrow =
    delta?.direction === "up" ? "▲" : delta?.direction === "down" ? "▼" : "";

  return (
    <div className={cn("min-w-0", className)}>
      <div className="section-label text-muted">{label}</div>
      <div
        className={cn("mt-1 tabular-nums tracking-tight text-fg", VALUE[size])}
        data-testid={valueTestId}
      >
        {numeric ? (
          <CountUp value={value} format={fmt} speed={speed} />
        ) : (
          value
        )}
      </div>
      {delta ? (
        <div className={cn("mt-1 text-xs font-medium", deltaColor)}>
          {arrow ? `${arrow} ` : ""}
          {delta.label}
        </div>
      ) : null}
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}
