import DateRangePicker from "@/components/DateRangePicker";
import InsightsCreativeTable from "@/components/insights/InsightsCreativeTable";
import InsightsFilters from "@/components/insights/InsightsFilters";
import InsightsRateCards from "@/components/insights/InsightsRateCards";
import InsightsSourceBooked from "@/components/insights/InsightsSourceBooked";
import InsightsTrendSection from "@/components/insights/InsightsTrendSection";
import { getInsightsData } from "@/lib/db/insights";
import { addDaysISO, clampDateRange, inclusiveDayCount, toISODate } from "@/lib/utils/date";

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export default async function InsightsPage({
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
    // default range
  }

  const sources = parseList(searchParams.source);
  const hasCustomRange = Boolean(searchParams.from || searchParams.to);
  const rangeDays = inclusiveDayCount(fromISO, toISO);

  const { metrics, sources: allSources } = await getInsightsData(
    fromISO,
    toISO,
    sources.length ? sources : undefined
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Insights</h1>
          <p className="mt-1 text-sm text-slate-600">
            {fromISO} to {toISO}
          </p>
        </div>
        <DateRangePicker
          fromISO={fromISO}
          toISO={toISO}
          hasCustomRange={hasCustomRange}
          pathname="/insights"
          extraParams={{ source: sources.join(",") }}
        />
      </div>

      <InsightsFilters
        sources={allSources}
        selectedSources={sources}
        fromISO={fromISO}
        toISO={toISO}
      />

      <InsightsRateCards
        formQualified={metrics.formQualified}
        setterVerified={metrics.setterVerified}
        showUp={metrics.showUp}
        closure={metrics.closure}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-medium text-slate-900">Ad creative</h2>
          <InsightsCreativeTable
            rows={metrics.creatives}
            unmatchedLeadCount={metrics.unmatchedLeadCount}
          />
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-900">Source → calls booked</h2>
          <div className="rounded border border-slate-200 p-4">
            <InsightsSourceBooked rows={metrics.sourceBooked} />
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-900">Daily</h2>
        <div className="rounded border border-slate-200 p-4">
          <InsightsTrendSection trend={metrics.daily} rangeDays={rangeDays} />
        </div>
      </section>
    </div>
  );
}
