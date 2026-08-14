import type { RateStat } from "@/lib/insights/metrics";
import { formatInteger } from "@/lib/format";

function Card({
  label,
  stat
}: {
  label: string;
  stat: RateStat;
}) {
  const pct =
    stat.rate === null
      ? "—"
      : `${Math.round(stat.rate).toLocaleString("en-IN")}%`;

  return (
    <div className="rounded border border-slate-200 p-5">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{pct}</div>
      <p className="mt-1 text-xs text-slate-500">
        {formatInteger(stat.numerator)} of {formatInteger(stat.denominator)}
      </p>
    </div>
  );
}

export default function InsightsRateCards({
  formQualified,
  setterVerified,
  showUp,
  closure
}: {
  formQualified: RateStat;
  setterVerified: RateStat;
  showUp: RateStat;
  closure: RateStat;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Form-Qualified Rate" stat={formQualified} />
      <Card label="Setter-Verified Rate" stat={setterVerified} />
      <Card label="Show-Up Rate" stat={showUp} />
      <Card label="Closure Rate" stat={closure} />
    </section>
  );
}
