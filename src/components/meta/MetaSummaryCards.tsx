import { formatPeriodComparison } from "@/lib/format";
import { EnterStagger } from "@/components/ui/Enter";
import Stat from "@/components/ui/Stat";

type Totals = {
  totalSpend: number;
  totalLeads: number;
  blendedCostPerLead: number | null;
  averageCtrPercent: number;
};

export default function MetaSummaryCards({
  totals,
  priorTotals,
  periodDays
}: {
  totals: Totals;
  priorTotals: Totals | null;
  periodDays: number;
}) {
  const prior = priorTotals;

  return (
    <EnterStagger id="meta-summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="stat-card">
        <Stat
          label="Total Spend"
          value={totals.totalSpend}
          format="currency"
          sub={
            prior
              ? formatPeriodComparison(
                  totals.totalSpend,
                  prior.totalSpend,
                  periodDays
                )
              : null
          }
        />
      </div>
      <div className="stat-card">
        <Stat
          label="Total Leads"
          value={totals.totalLeads}
          format="integer"
          sub={
            prior
              ? formatPeriodComparison(
                  totals.totalLeads,
                  prior.totalLeads,
                  periodDays
                )
              : null
          }
        />
      </div>
      <div className="stat-card">
        <Stat
          label="Blended Cost / Lead"
          value={
            totals.blendedCostPerLead === null
              ? "—"
              : totals.blendedCostPerLead
          }
          format="currency"
          sub={
            prior &&
            totals.blendedCostPerLead !== null &&
            prior.blendedCostPerLead !== null
              ? formatPeriodComparison(
                  totals.blendedCostPerLead,
                  prior.blendedCostPerLead,
                  periodDays
                )
              : null
          }
        />
      </div>
      <div className="stat-card">
        <Stat
          label="Average CTR%"
          value={totals.averageCtrPercent}
          format="percent"
          sub={
            prior
              ? formatPeriodComparison(
                  totals.averageCtrPercent,
                  prior.averageCtrPercent,
                  periodDays
                )
              : null
          }
        />
      </div>
    </EnterStagger>
  );
}
