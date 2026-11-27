"use client";

import type { RateStat } from "@/lib/insights/metrics";
import {
  formatCancelledBreakdown,
  type CancelledBookingsStat
} from "@/lib/leads/cancelledBookings";
import { INSIGHTS_TOOLTIPS } from "@/lib/insights/tooltips";
import { formatInteger } from "@/lib/format";
import InfoTip from "@/components/InfoTip";
import { EnterStagger } from "@/components/ui/Enter";
import Stat from "@/components/ui/Stat";

function Card({
  label,
  tip,
  stat
}: {
  label: string;
  tip: string;
  stat: RateStat;
}) {
  return (
    <div className="stat-card">
      <Stat
        label={
          <span className="inline-flex items-center gap-1.5">
            {label}
            <InfoTip text={tip} />
          </span>
        }
        value={stat.rate === null ? "—" : stat.rate}
        format="percent0"
        sub={
          <>
            <span
              data-testid={
                label === "Closure Rate" ? "insights-won-count" : undefined
              }
            >
              {formatInteger(stat.numerator)}
            </span>
            {` of ${formatInteger(stat.denominator)}`}
          </>
        }
      />
    </div>
  );
}

export default function InsightsRateCards({
  formQualified,
  qualified,
  showUp,
  closure,
  cancelledBookings
}: {
  formQualified: RateStat;
  qualified: RateStat;
  showUp: RateStat;
  closure: RateStat;
  cancelledBookings: CancelledBookingsStat;
}) {
  const cancelledSub = formatCancelledBreakdown(cancelledBookings) || "None in range";
  return (
    <EnterStagger id="insights-rates" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card
        label="Form-Qualified Rate"
        tip={INSIGHTS_TOOLTIPS.formQualified}
        stat={formQualified}
      />
      <Card
        label="Qualified Rate"
        tip={INSIGHTS_TOOLTIPS.qualified}
        stat={qualified}
      />
      <Card label="Show-Up Rate" tip={INSIGHTS_TOOLTIPS.showUp} stat={showUp} />
      <Card label="Closure Rate" tip={INSIGHTS_TOOLTIPS.closure} stat={closure} />
      <div className="stat-card">
        <Stat
          label={
            <span className="inline-flex items-center gap-1.5">
              Cancelled bookings
              <InfoTip text={INSIGHTS_TOOLTIPS.cancelledBookings} />
            </span>
          }
          value={cancelledBookings.total}
          format="integer"
          sub={cancelledSub}
          valueTestId="insights-cancelled-bookings"
        />
      </div>
    </EnterStagger>
  );
}
