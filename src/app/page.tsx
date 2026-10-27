import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import CohortMaturityNote from "@/components/CohortMaturityNote";
import DateRangePicker from "@/components/DateRangePicker";
import { countLeads, listDistinctLeadSources, listLeads } from "@/lib/db/leads";
import {
  HOME_FUNNEL_KPIS,
  KPI_DEFINITIONS,
  type KpiKey
} from "@/lib/leads/lifecycleDefinitions";
import { kpiLeadsHref } from "@/lib/leads/listFilterParams";
import { formatCurrency, formatInteger, formatPercent } from "@/lib/format";
import {
  clampDateRange,
  defaultFromISO,
  isCohortImmature
} from "@/lib/utils/date";
import { todayISTDateString } from "@/lib/timezone";

function rate(num: number, den: number): number {
  if (den <= 0) return 0;
  return (num / den) * 100;
}

export default async function HomePage({
  searchParams
}: {
  searchParams: { from?: string; to?: string; source?: string };
}) {
  const todayISO = todayISTDateString();
  let fromISO = defaultFromISO(todayISO);
  let toISO = todayISO;
  try {
    if (searchParams.from && searchParams.to) {
      const clamped = clampDateRange(searchParams.from, searchParams.to);
      fromISO = clamped.fromISO;
      toISO = clamped.toISO;
    }
  } catch {
    // default
  }

  const source = searchParams.source ?? "";
  const sources = source ? source.split(",").filter(Boolean) : undefined;
  const hasCustomRange = Boolean(searchParams.from || searchParams.to);
  const immature = isCohortImmature(toISO, todayISO);
  const orgId = await getCurrentOrgId();
  const range = { fromISO, toISO };
  const base = { orgId, fromISO, toISO, sources };

  const kpiKeys: KpiKey[] = [...HOME_FUNNEL_KPIS, "deals_closed"];
  const [allSources, closedRows, ...kpiCounts] = await Promise.all([
    listDistinctLeadSources(orgId),
    listLeads({ ...base, kpi: "deals_closed" }),
    ...kpiKeys.map((kpi) => countLeads({ ...base, kpi }))
  ]);

  const counts = Object.fromEntries(kpiKeys.map((k, i) => [k, kpiCounts[i] ?? 0])) as Record<
    KpiKey,
    number
  >;
  const revenue = closedRows.reduce((s, l) => s + (l.deal_value ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Funnel overview</h1>
          <p className="mt-1 text-sm text-slate-600">
            {fromISO} to {toISO}
          </p>
        </div>
        <DateRangePicker
          fromISO={fromISO}
          toISO={toISO}
          hasCustomRange={hasCustomRange}
          pathname="/"
          extraParams={{ source }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`/?from=${fromISO}&to=${toISO}`}
          className={`rounded border px-3 py-1.5 text-sm ${!source ? "ui-active" : "border-slate-200 text-slate-700"}`}
        >
          All sources
        </a>
        {allSources.map((s) => (
          <a
            key={s}
            href={`/?from=${fromISO}&to=${toISO}&source=${encodeURIComponent(s)}`}
            className={`rounded border px-3 py-1.5 text-sm ${source === s ? "ui-active" : "border-slate-200 text-slate-700"}`}
          >
            {s}
          </a>
        ))}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <div className="text-xs text-slate-600">Booked Rate</div>
          <div className="mt-2 text-xl font-semibold">
            {formatPercent(rate(counts.calls_booked, counts.leads))}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-slate-600">Show-up Rate</div>
          <div className="mt-2 text-xl font-semibold">
            {formatPercent(rate(counts.showups, counts.calls_booked))}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-slate-600">Closing Rate</div>
          <div className="mt-2 text-xl font-semibold">
            {formatPercent(rate(counts.deals_closed, counts.showups))}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-slate-600">Total Revenue</div>
          <div className="mt-2 text-xl font-semibold">{formatCurrency(revenue)}</div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-900">Funnel</h2>
        {immature ? <CohortMaturityNote /> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HOME_FUNNEL_KPIS.map((kpi, i) => {
            const count = counts[kpi];
            const prev = i === 0 ? counts.leads : counts[HOME_FUNNEL_KPIS[i - 1]!];
            const cvr = i === 0 ? 100 : rate(count, prev);
            return (
              <a
                key={kpi}
                href={kpiLeadsHref(kpi, range, { sources })}
                className="rounded border border-slate-200 p-4 hover:border-slate-300"
              >
                <div className="text-xs text-slate-600">{KPI_DEFINITIONS[kpi].label}</div>
                <div className="mt-2 text-xl font-semibold text-slate-900">
                  {formatInteger(count)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {i === 0 ? "in this range" : `${cvr.toFixed(0)}% of previous`}
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <div className="flex gap-4 text-sm">
        <a href="/insights" className="text-slate-700 hover:text-slate-900">
          Insights →
        </a>
        <a href="/leads" className="text-slate-700 hover:text-slate-900">
          Open leads CRM →
        </a>
        <a href="/meta-ads" className="text-slate-700 hover:text-slate-900">
          Meta Ads →
        </a>
        <a href="/website" className="text-slate-700 hover:text-slate-900">
          Website analytics →
        </a>
      </div>
    </div>
  );
}
