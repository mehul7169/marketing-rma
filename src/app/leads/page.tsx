import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import DateRangePicker from "@/components/DateRangePicker";
import LeadsFilters from "@/components/leads/LeadsFilters";
import { stageLabel } from "@/components/leads/StageBadge";
import ConfigurableLeadsTable from "@/components/table-views/ConfigurableLeadsTable";
import PersistFilterState from "@/components/table-views/PersistFilterState";
import { DataTablePageShell } from "@/components/table-views/ScrollableDataTable";
import Pagination from "@/components/ui/Pagination";
import { listDueFollowUps } from "@/lib/db/lead_reminders";
import { countLeads, listDistinctLeadSources, listLeads } from "@/lib/db/leads";
import { getOrganizationById } from "@/lib/db/organizations";
import {
  buildLeadsQuery,
  parseLeadsFilterParams,
  type LeadsSearchParams
} from "@/lib/leads/listFilterParams";
import {
  cohortBannerCopy,
  eventBannerCopy,
  parseUrlEvent
} from "@/lib/leads/stageEvents";
import {
  LEAD_LIST_PAGE_SIZE,
  pageOffset,
  parsePageParam
} from "@/lib/leads/pagination";
import {
  loadTableViewBootstrap,
  restorePersistedFilters
} from "@/lib/table-views/loadBootstrap";
import { todayISTDateString } from "@/lib/timezone";
import type { LeadListFilters, LeadReminder } from "@/lib/leads/types";

export default async function LeadsPage({
  searchParams
}: {
  searchParams: LeadsSearchParams;
}) {
  const orgId = await getCurrentOrgId();
  await restorePersistedFilters("leads", "/leads", searchParams, orgId);

  const todayISO = todayISTDateString();
  const filterState = parseLeadsFilterParams(searchParams, todayISO);
  const { fromISO, toISO, lifecycle, stages, sources, cohort, event } = filterState;
  const cohortStage = parseUrlEvent(cohort);
  const eventStage = cohortStage ? null : parseUrlEvent(event);
  const deepLinkStage = cohortStage ?? eventStage;
  const needsVerificationCall = lifecycle === "needs_verification";
  const followUpsDue = lifecycle === "follow_ups_due";
  const page = parsePageParam(
    Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page
  );

  const scopeFilters: LeadListFilters = {
    orgId,
    fromISO,
    toISO,
    stages: deepLinkStage ? undefined : stages,
    cohort,
    event: cohortStage ? undefined : event,
    sources,
    search: filterState.q,
    lifecycle: followUpsDue || needsVerificationCall ? undefined : lifecycle,
    followUpsDue,
    needsVerificationCall,
    actionStatuses: filterState.actionStatuses.length
      ? filterState.actionStatuses
      : undefined,
    isDead:
      filterState.isDead === "true"
        ? true
        : filterState.isDead === "false"
          ? false
          : undefined
  };

  const [total, rows, allSources, org, tableViewBootstrap] = await Promise.all([
    countLeads(scopeFilters),
    listLeads({
      ...scopeFilters,
      limit: LEAD_LIST_PAGE_SIZE,
      offset: pageOffset(page)
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

  const query = buildLeadsQuery(filterState);
  const dateExtraParams: Record<string, string> = { ...query };
  delete dateExtraParams.from;
  delete dateExtraParams.to;

  return (
    <DataTablePageShell className="gap-6">
      <PersistFilterState pageKey="leads" />
      <div className="shrink-0 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-title">Leads</h1>
            <p className="mt-1 text-sm text-slate-600">
              {lifecycle === "follow_ups_due"
                ? `${total} with follow-ups due today or overdue`
                : lifecycle === "needs_verification"
                  ? `${total} needing a verification call`
                  : `${total} in ${fromISO} to ${toISO}`}
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
            key={`${fromISO}:${toISO}`}
            fromISO={fromISO}
            toISO={toISO}
            hasCustomRange={!filterState.isDefaultRange}
            pathname="/leads"
            extraParams={dateExtraParams}
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
          state={filterState}
          deepLinkLabel={deepLinkStage ? stageLabel(deepLinkStage) : undefined}
        />
      </div>

      <ConfigurableLeadsTable
        pageKey="leads"
        rows={rows}
        dueByLead={dueByLead}
        orgName={org?.name ?? null}
        tableViewBootstrap={tableViewBootstrap}
      />
      <div className="shrink-0">
        <Pagination
          page={page}
          total={total}
          pageSize={LEAD_LIST_PAGE_SIZE}
          pathname="/leads"
          query={query}
        />
      </div>
    </DataTablePageShell>
  );
}
