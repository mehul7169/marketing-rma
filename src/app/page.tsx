import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import CohortMaturityNote from "@/components/CohortMaturityNote";
import MetaAdsHealthBanner from "@/components/cron/MetaAdsHealthBanner";
import DateRangePicker from "@/components/DateRangePicker";
import { countLeads, listDistinctLeadSources, listLeads } from "@/lib/db/leads";
import {
  HOME_FUNNEL_KPIS,
  KPI_DEFINITIONS,
  type KpiKey
} from "@/lib/leads/lifecycleDefinitions";
import { kpiLeadsHref } from "@/lib/leads/listFilterParams";
import { EnterStagger } from "@/components/ui/Enter";
import Stat from "@/components/ui/Stat";
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
      <MetaAdsHealthBanner orgId={orgId} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Funnel overview</h1>
          <p className="mt-1 text-sm text-muted">
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
          className={`rounded border px-3 py-1.5 text-sm ${!source ? "ui-active" : "border-subtle text-fg"}`}
        >
          All sources
        </a>
        {allSources.map((s) => (
          <a
            key={s}
            href={`/?from=${fromISO}&to=${toISO}&source=${encodeURIComponent(s)}`}
            className={`rounded border px-3 py-1.5 text-sm ${source === s ? "ui-active" : "border-subtle text-fg"}`}
          >
            {s}
          </a>
        ))}
      </div>

      <EnterStagger id="home-rates" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <Stat
            label="Booked Rate"
            value={rate(counts.calls_booked, counts.leads)}
            format="percent"
            size="md"
          />
        </div>
        <div className="stat-card">
          <Stat
            label="Show-up Rate"
            value={rate(counts.showups, counts.calls_booked)}
            format="percent"
            size="md"
          />
        </div>
        <div className="stat-card">
          <Stat
            label="Closing Rate"
            value={rate(counts.deals_closed, counts.showups)}
            format="percent"
            size="md"
          />
        </div>
        <div className="stat-card">
          <Stat
            label="Total Revenue"
            value={revenue}
            format="currency"
            size="md"
          />
        </div>
      </EnterStagger>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-fg">Funnel</h2>
        {immature ? <CohortMaturityNote /> : null}
        <EnterStagger id="home-funnel" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HOME_FUNNEL_KPIS.map((kpi, i) => {
            const count = counts[kpi];
            const prev = i === 0 ? counts.leads : counts[HOME_FUNNEL_KPIS[i - 1]!];
            const cvr = i === 0 ? 100 : rate(count, prev);
            return (
              <a
                key={kpi}
                href={kpiLeadsHref(kpi, range, { sources })}
                className="lift-card rounded border border-subtle p-4 hover:border-subtle"
              >
                <Stat
                  label={KPI_DEFINITIONS[kpi].label}
                  value={count}
                  format="integer"
                  sub={i === 0 ? "in this range" : `${cvr.toFixed(0)}% of previous`}
                />
              </a>
            );
          })}
        </EnterStagger>
      </section>

      <div className="flex gap-4 text-sm">
        <a href="/insights" className="text-fg hover:text-fg">
          Insights →
        </a>
        <a href="/leads" className="text-fg hover:text-fg">
          Open leads CRM →
        </a>
        <a href="/meta-ads" className="text-fg hover:text-fg">
          Meta Ads →
        </a>
        <a href="/website" className="text-fg hover:text-fg">
          Website analytics →
        </a>
      </div>
    </div>
  );
}
