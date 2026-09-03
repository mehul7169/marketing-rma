import CopyValue from "@/components/CopyValue";
import DateRangePicker from "@/components/DateRangePicker";
import DueFollowUpBadge from "@/components/leads/DueFollowUpBadge";
import LeadRow from "@/components/leads/LeadRow";
import LeadsFilters from "@/components/leads/LeadsFilters";
import RecordingLinkBadge from "@/components/leads/RecordingLinkBadge";
import StageBadge from "@/components/leads/StageBadge";
import { listDueFollowUps } from "@/lib/db/lead_reminders";
import { listDistinctLeadSources, listLeads } from "@/lib/db/leads";
import {
  cohortBannerCopy,
  eventBannerCopy,
  parseUrlEvent
} from "@/lib/leads/stageEvents";
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
    event?: string;
    cohort?: string;
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
  const cohort = searchParams.cohort?.trim() || undefined;
  const event = searchParams.event?.trim() || undefined;
  const cohortStage = parseUrlEvent(cohort);
  const eventStage = cohortStage ? null : parseUrlEvent(event);
  const deepLinkStage = cohortStage ?? eventStage;
  const sources = parseList(searchParams.source);
  const search = searchParams.q ?? "";
  // Overview deep links should not be clipped by Active-only default.
  const lifecycle =
    searchParams.lifecycle ?? (deepLinkStage ? "all" : "active");
  const hasCustomRange = Boolean(searchParams.from || searchParams.to);
  const needsVerificationCall = lifecycle === "needs_verification";
  const followUpsDue = lifecycle === "follow_ups_due";

  const [rows, allSources] = await Promise.all([
    listLeads({
      fromISO,
      toISO,
      stages: deepLinkStage ? undefined : stages,
      cohort,
      event: cohortStage ? undefined : event,
      sources,
      search,
      lifecycle:
        followUpsDue || needsVerificationCall ? undefined : lifecycle,
      followUpsDue,
      needsVerificationCall
    }),
    listDistinctLeadSources()
  ]);

  const dueReminders = await listDueFollowUps(rows.map((r) => r.id));
  const dueByLead = new Map<string, typeof dueReminders>();
  for (const r of dueReminders) {
    const list = dueByLead.get(r.lead_id) ?? [];
    list.push(r);
    dueByLead.set(r.lead_id, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Leads</h1>
          <p className="mt-1 text-sm text-slate-600">
            {lifecycle === "follow_ups_due"
              ? `${rows.length} with follow-ups due today or overdue`
              : lifecycle === "needs_verification"
                ? `${rows.length} needing a verification call`
                : `${rows.length} in ${fromISO} to ${toISO}`}
          </p>
        </div>
        <DateRangePicker
          fromISO={fromISO}
          toISO={toISO}
          hasCustomRange={hasCustomRange}
          pathname="/leads"
          extraParams={{
            stage: deepLinkStage ? undefined : stages.join(","),
            cohort,
            event: cohortStage ? undefined : event,
            source: sources.join(","),
            q: search,
            lifecycle
          }}
        />
      </div>

      {cohortStage ? (
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {cohortBannerCopy(cohortStage)}
        </p>
      ) : eventStage ? (
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {eventBannerCopy(eventStage)}
        </p>
      ) : null}

      <LeadsFilters
        sources={allSources}
        selectedStages={deepLinkStage ? [] : stages}
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
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Stage</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Call scheduled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No leads in this filter.
                </td>
              </tr>
            ) : (
              rows.map((lead) => (
                <LeadRow key={lead.id} href={`/leads/${lead.id}`}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {lead.name || "—"}
                    <DueFollowUpBadge reminders={dueByLead.get(lead.id) ?? []} />
                    <RecordingLinkBadge url={lead.recording_url} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      {lead.email}
                      <CopyValue value={lead.email} hoverReveal />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      {lead.phone || "—"}
                      <CopyValue value={lead.phone} hoverReveal />
                    </span>
                  </td>
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
