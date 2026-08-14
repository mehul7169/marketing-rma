import DateRangePicker from "@/components/DateRangePicker";
import { listDistinctLeadSources, listLeadsInRange } from "@/lib/db/leads";
import { FUNNEL_STEPS } from "@/lib/leads/computeStage";
import type { LeadRow } from "@/lib/leads/types";
import { formatCurrency, formatInteger, formatPercent } from "@/lib/format";
import { addDaysISO, clampDateRange, toISODate } from "@/lib/utils/date";

function rate(num: number, den: number): number {
  if (den <= 0) return 0;
  return (num / den) * 100;
}

function funnelCounts(leads: LeadRow[]) {
  const total = leads.length;
  const formFilled = leads.filter((l) => l.form_filled_at).length;
  const qualified = leads.filter((l) => l.qualified === true).length;
  const booked = leads.filter((l) => {
    if (!l.call_booked_at) return false;
    if (!l.call_cancelled_at) return true;
    return l.call_booked_at > l.call_cancelled_at;
  }).length;
  const verified = leads.filter((l) => l.setter_verified === true).length;
  const showed = leads.filter((l) => l.call_showed === true).length;
  const closed = leads.filter((l) => l.deal_closed === true).length;
  const revenue = leads
    .filter((l) => l.deal_closed === true)
    .reduce((s, l) => s + (l.deal_value ?? 0), 0);

  const counts: Record<string, number> = {
    lead: total,
    form_filled: formFilled,
    qualified,
    booked,
    verified,
    showed,
    closed
  };

  return { total, formFilled, qualified, booked, verified, showed, closed, revenue, counts };
}

export default async function HomePage({
  searchParams
}: {
  searchParams: { from?: string; to?: string; source?: string };
}) {
  const todayISO = toISODate(new Date());
  let fromISO = addDaysISO(todayISO, -29);
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

  const [leads, allSources] = await Promise.all([
    listLeadsInRange(fromISO, toISO, sources),
    listDistinctLeadSources()
  ]);

  const f = funnelCounts(leads);
  const prevCounts = [
    f.total,
    f.formFilled,
    f.qualified,
    f.booked,
    f.verified,
    f.showed,
    f.closed
  ];

  function leadsHref(stage?: string) {
    const params = new URLSearchParams();
    params.set("from", fromISO);
    params.set("to", toISO);
    if (source) params.set("source", source);
    if (stage && stage !== "lead") params.set("stage", stage);
    return `/leads?${params.toString()}`;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Funnel overview</h1>
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
          className={`rounded border px-3 py-1.5 text-sm ${!source ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
        >
          All sources
        </a>
        {allSources.map((s) => (
          <a
            key={s}
            href={`/?from=${fromISO}&to=${toISO}&source=${encodeURIComponent(s)}`}
            className={`rounded border px-3 py-1.5 text-sm ${source === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
          >
            {s}
          </a>
        ))}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded border border-slate-200 p-5">
          <div className="text-xs text-slate-600">Total Leads</div>
          <div className="mt-2 text-xl font-semibold">{formatInteger(f.total)}</div>
        </div>
        <div className="rounded border border-slate-200 p-5">
          <div className="text-xs text-slate-600">Qualified Rate</div>
          <div className="mt-2 text-xl font-semibold">
            {formatPercent(rate(f.qualified, f.formFilled || f.total))}
          </div>
        </div>
        <div className="rounded border border-slate-200 p-5">
          <div className="text-xs text-slate-600">Show-up Rate</div>
          <div className="mt-2 text-xl font-semibold">
            {formatPercent(rate(f.showed, f.booked))}
          </div>
        </div>
        <div className="rounded border border-slate-200 p-5">
          <div className="text-xs text-slate-600">Closing Rate</div>
          <div className="mt-2 text-xl font-semibold">
            {formatPercent(rate(f.closed, f.showed))}
          </div>
        </div>
        <div className="rounded border border-slate-200 p-5">
          <div className="text-xs text-slate-600">Total Revenue</div>
          <div className="mt-2 text-xl font-semibold">{formatCurrency(f.revenue)}</div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-900">Funnel</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {FUNNEL_STEPS.map((step, i) => {
            const count = f.counts[step.stage] ?? 0;
            const prev = i === 0 ? f.total : prevCounts[i - 1];
            const cvr = i === 0 ? 100 : rate(count, prev);
            return (
              <a
                key={step.stage}
                href={leadsHref(step.stage)}
                className="rounded border border-slate-200 p-4 hover:border-slate-300"
              >
                <div className="text-xs text-slate-600">{step.label}</div>
                <div className="mt-2 text-xl font-semibold text-slate-900">
                  {formatInteger(count)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {i === 0 ? "100% of leads" : `${cvr.toFixed(0)}% of previous`}
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
