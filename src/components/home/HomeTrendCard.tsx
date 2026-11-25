"use client";

import { useState } from "react";
import ChartCard from "@/components/ui/ChartCard";
import Segmented from "@/components/ui/Segmented";
import StackedTrafficBarChart from "@/components/home/StackedTrafficBarChart";
import { formatInteger } from "@/lib/format";
import {
  TREND_KPI_OPTIONS,
  type HomeTrendKpi
} from "@/lib/home/assemble";
import type { TrendPoint } from "@/lib/home/metrics";
import type { TrendBucket } from "@/lib/home/range";

export default function HomeTrendCard({
  trends,
  bucket
}: {
  trends: Record<HomeTrendKpi, TrendPoint[]>;
  bucket: TrendBucket;
}) {
  const [kpi, setKpi] = useState<HomeTrendKpi>("calls_booked");
  const data = trends[kpi];
  const total = data.reduce((s, p) => s + p.total, 0);
  const label = TREND_KPI_OPTIONS.find((o) => o.value === kpi)?.label ?? kpi;

  return (
    <div data-testid="home-trend">
      <ChartCard
        title="Trend"
        toggle={
          <Segmented
            ariaLabel="Trend metric"
            options={TREND_KPI_OPTIONS}
            value={kpi}
            onChange={setKpi}
          />
        }
        legend={
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Paid
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-neutral-series" />
              Organic
            </span>
          </div>
        }
      >
        <StackedTrafficBarChart data={data} bucket={bucket} />
        <p className="mt-3 text-xs text-muted" data-testid="home-trend-total">
          {formatInteger(total)} {label.toLowerCase()} in this period
        </p>
      </ChartCard>
    </div>
  );
}
