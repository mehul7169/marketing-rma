import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import DateRangePicker from "@/components/DateRangePicker";
import LeadsFilters from "@/components/leads/LeadsFilters";
import ConfigurableLeadsTable from "@/components/table-views/ConfigurableLeadsTable";
import { DataTablePageShell } from "@/components/table-views/ScrollableDataTable";
import { listDueFollowUps } from "@/lib/db/lead_reminders";
import { listDistinctLeadSources, listLeads } from "@/lib/db/leads";
import { getOrganizationById } from "@/lib/db/organizations";
import {
  cohortBannerCopy,
  eventBannerCopy,
  parseUrlEvent
} from "@/lib/leads/stageEvents";
import { loadTableViewBootstrap } from "@/lib/table-views/loadBootstrap";
import { clampDateRange, defaultFromISO } from "@/lib/utils/date";
import { todayISTDateString } from "@/lib/timezone";
import type { LeadReminder } from "@/lib/leads/types";

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
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
    action_status?: string;
    is_dead?: string;
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
  const actionStatusFilter = searchParams.action_status?.trim() || "";
  const isDeadFilter = searchParams.is_dead?.trim() || "";
  const lifecycle =
    searchParams.lifecycle ?? (deepLinkStage ? "all" : "active");
  const hasCustomRange = Boolean(searchParams.from || searchParams.to);
  const needsVerificationCall = lifecycle === "needs_verification";
  const followUpsDue = lifecycle === "follow_ups_due";
  const orgId = await getCurrentOrgId();

  const [rows, allSources, org, tableViewBootstrap] = await Promise.all([
    listLeads({
      orgId,
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
      needsVerificationCall,
      actionStatuses: actionStatusFilter ? [actionStatusFilter] : undefined,
      isDead:
        isDeadFilter === "true"
          ? true
          : isDeadFilter === "false"
            ? false
            : undefined
    }),
    listDistinctLeadSources(orgId),
    getOrganizationById(orgId),
    loadTableViewBootstrap("leads", { orgId })
  ]);

  const dueReminders = await listDueFollowUps(
    orgId,
    rows.map((r) => r.id)
  );
  const dueByLead: Record<string, LeadReminder[]> = {};
  for (const r of dueReminders) {
    const list = dueByLead[r.lead_id] ?? [];
    list.push(r);
    dueByLead[r.lead_id] = list;
  }

  return (
    <DataTablePageShell className="gap-6">
      <div className="shrink-0 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-title">Leads</h1>
            <p className="mt-1 text-sm text-slate-600">
              {lifecycle === "follow_ups_due"
                ? `${rows.length} with follow-ups due today or overdue`
                : lifecycle === "needs_verification"
                  ? `${rows.length} needing a verification call`
                  : `${rows.length} in ${fromISO} to ${toISO}`}
              {" · "}
              <a
                href="/leads/queue"
                className="underline decoration-slate-300 hover:text-slate-900"
              >
                Work Queue
              </a>
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
              lifecycle,
              action_status: actionStatusFilter || undefined,
              is_dead: isDeadFilter || undefined
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
          actionStatus={actionStatusFilter}
          isDead={isDeadFilter}
        />
      </div>

      <ConfigurableLeadsTable
        pageKey="leads"
        rows={rows}
        dueByLead={dueByLead}
        orgName={org?.name ?? null}
        tableViewBootstrap={tableViewBootstrap}
      />
    </DataTablePageShell>
  );
}
