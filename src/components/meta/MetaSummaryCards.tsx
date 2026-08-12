import {
  formatCurrency,
  formatCurrencyNullable,
  formatInteger,
  formatPercent,
  formatPeriodComparison
} from "@/lib/format";

type Totals = {
  totalSpend: number;
  totalLeads: number;
  blendedCostPerLead: number | null;
  averageCtrPercent: number;
};

function ComparisonSubtext({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="mt-1 text-xs text-slate-500">{text}</p>;
}

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
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded border border-slate-200 p-5">
        <div className="text-xs text-slate-600">Total Spend</div>
        <div className="mt-2 text-xl font-semibold text-slate-900">
          {formatCurrency(totals.totalSpend)}
        </div>
        <ComparisonSubtext
          text={
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
      <div className="rounded border border-slate-200 p-5">
        <div className="text-xs text-slate-600">Total Leads</div>
        <div className="mt-2 text-xl font-semibold text-slate-900">
          {formatInteger(totals.totalLeads)}
        </div>
        <ComparisonSubtext
          text={
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
      <div className="rounded border border-slate-200 p-5">
        <div className="text-xs text-slate-600">Blended Cost / Lead</div>
        <div className="mt-2 text-xl font-semibold text-slate-900">
          {formatCurrencyNullable(totals.blendedCostPerLead)}
        </div>
        <ComparisonSubtext
          text={
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
      <div className="rounded border border-slate-200 p-5">
        <div className="text-xs text-slate-600">Average CTR%</div>
        <div className="mt-2 text-xl font-semibold text-slate-900">
          {formatPercent(totals.averageCtrPercent)}
        </div>
        <ComparisonSubtext
          text={
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
    </section>
  );
}
