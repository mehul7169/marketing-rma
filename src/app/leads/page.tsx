import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import { redirect } from "next/navigation";
import DateRangePicker from "@/components/DateRangePicker";
import LeadsFilters from "@/components/leads/LeadsFilters";
import ConfigurableLeadsTable from "@/components/table-views/ConfigurableLeadsTable";
import PersistFilterState from "@/components/table-views/PersistFilterState";
import { DataTablePageShell } from "@/components/table-views/ScrollableDataTable";
import Pagination from "@/components/ui/Pagination";
import { listDueFollowUps } from "@/lib/db/lead_reminders";
import { countLeads, listDistinctLeadSources, listLeads } from "@/lib/db/leads";
import { getOrganizationById } from "@/lib/db/organizations";
import { kpiBannerCopy } from "@/lib/leads/lifecycleDefinitions";
import {
  buildLeadsQuery,
  hasLegacyLeadsParams,
  leadListFiltersFromState,
  leadsHref,
  parseLeadsFilterParams,
  type LeadsSearchParams
} from "@/lib/leads/listFilterParams";
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
import type { LeadReminder } from "@/lib/leads/types";

export default async function LeadsPage({
  searchParams
}: {
  searchParams: LeadsSearchParams;
}) {
  const orgId = await getCurrentOrgId();
  await restorePersistedFilters("leads", "/leads", searchParams, orgId);

  const todayISO = todayISTDateString();
  const filterState = parseLeadsFilterParams(searchParams, todayISO);
  // Old links / saved state: rewrite onto the new keys (persistence then saves those).
  if (hasLegacyLeadsParams(searchParams)) redirect(leadsHref(filterState));

  const { fromISO, toISO, kpi } = filterState;
  const page = parsePageParam(
    Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page
  );

  const scopeFilters = leadListFiltersFromState(orgId, filterState);

  const [total, rows, allSources, org, tableViewBootstrap, dueReminders] =
    await Promise.all([
      countLeads(scopeFilters),
      listLeads({
        ...scopeFilters,
        limit: LEAD_LIST_PAGE_SIZE,
        offset: pageOffset(page)
      }),
      listDistinctLeadSources(orgId),
      getOrganizationById(orgId),
      loadTableViewBootstrap("leads", { orgId }),
      listDueFollowUps(orgId)
    ]);
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
              {`${total} in ${fromISO} to ${toISO}`}
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

        {kpi ? (
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {kpiBannerCopy(kpi)}
          </p>
        ) : null}

        <LeadsFilters sources={allSources} state={filterState} />
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
