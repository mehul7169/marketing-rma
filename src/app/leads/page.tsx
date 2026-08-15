import DateRangePicker from "@/components/DateRangePicker";
import LeadRow from "@/components/leads/LeadRow";
import LeadsFilters from "@/components/leads/LeadsFilters";
import StageBadge from "@/components/leads/StageBadge";
import { listDistinctLeadSources, listLeads } from "@/lib/db/leads";
import { clampDateRange, defaultFromISO } from "@/lib/utils/date";
import { formatISTDateTime, todayISTDateString } from "@/lib/timezone";

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function fmtWhen(iso: string | null): string {
  return formatISTDateTime(iso);
}

export default async function LeadsPage({
  searchParams
}: {
  searchParams: {
    from?: string;
    to?: string;
    stage?: string;
    source?: string;
    q?: string;
    lifecycle?: string;
  };
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
    // default range
  }

  const stages = parseList(searchParams.stage);
  const sources = parseList(searchParams.source);
  const search = searchParams.q ?? "";
  const lifecycle = searchParams.lifecycle ?? "active";
  const hasCustomRange = Boolean(searchParams.from || searchParams.to);

  const [rows, allSources] = await Promise.all([
    listLeads({
      fromISO,
      toISO,
      stages,
      sources,
      search,
      lifecycle: lifecycle === "needs_requal" ? undefined : lifecycle,
      needsRequal: lifecycle === "needs_requal"
    }),
    listDistinctLeadSources()
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Leads</h1>
          <p className="mt-1 text-sm text-slate-600">
            {rows.length} in {fromISO} to {toISO}
          </p>
        </div>
        <DateRangePicker
          fromISO={fromISO}
          toISO={toISO}
          hasCustomRange={hasCustomRange}
          pathname="/leads"
          extraParams={{
            stage: stages.join(","),
            source: sources.join(","),
            q: search,
            lifecycle
          }}
        />
      </div>

      <LeadsFilters
        sources={allSources}
        selectedStages={stages}
        selectedSources={sources}
        search={search}
        fromISO={fromISO}
        toISO={toISO}
        lifecycle={lifecycle}
      />

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-[800px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-700">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Stage</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Call scheduled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No leads in this filter.
                </td>
              </tr>
            ) : (
              rows.map((lead) => (
                <LeadRow key={lead.id} href={`/leads/${lead.id}`}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {lead.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{lead.email}</td>
                  <td className="px-4 py-3 text-slate-700">{lead.lead_source || "—"}</td>
                  <td className="px-4 py-3">
                    <StageBadge stage={lead.stage} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {fmtWhen(lead.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {fmtWhen(lead.call_scheduled_for)}
                  </td>
                </LeadRow>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
