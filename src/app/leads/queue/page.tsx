import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import { redirect } from "next/navigation";
import { FilterPendingRoot } from "@/components/leads/FilterPending";
import WorkQueueControls from "@/components/leads/WorkQueueControls";
import WorkQueueView from "@/components/table-views/WorkQueueView";
import { DataTablePageShell } from "@/components/table-views/ScrollableDataTable";
import { listRecentLeadActivitiesForLeads } from "@/lib/db/lead_activities";
import { countLeads, listLeads } from "@/lib/db/leads";
import { getOrganizationById } from "@/lib/db/organizations";
import type { LeadActivityRow } from "@/lib/db/lead_activities";
import {
  LEAD_LIST_PAGE_SIZE,
  pageOffset,
  parsePageParam,
} from "@/lib/leads/pagination";
import PersistFilterState from "@/components/table-views/PersistFilterState";
import {
  loadTableViewBootstrap,
  restorePersistedFilters,
} from "@/lib/table-views/loadBootstrap";
import {
  isQueuePrimaryTab,
  LEGACY_QUEUE_FILTER_IDS,
  listFiltersForView,
  parseQueueFilter,
  parseQueueSort,
  parseQueueTab,
  queueHref,
} from "@/lib/leads/workQueueParams";

export default async function WorkQueuePage({
  searchParams,
}: {
  searchParams: {
    tab?: string;
    filter?: string;
    view?: string;
    search?: string;
    page?: string;
    show_unqualified?: string;
    sort?: string;
  };
}) {
  const orgId = await getCurrentOrgId();
  await restorePersistedFilters(
    "leads-queue",
    "/leads/queue",
    searchParams,
    orgId,
  );
  const tabId = parseQueueTab(searchParams.tab);
  const rawFilter = searchParams.filter?.trim() ?? "";
  const filterId = parseQueueFilter(rawFilter, tabId);
  const sort = parseQueueSort(searchParams.sort);
  const showFormUnqualified = searchParams.show_unqualified === "1";
  const initialViewMode = searchParams.view === "cards" ? "cards" : "table";
  const initialSearch = (searchParams.search ?? "").trim();
  const page = parsePageParam(searchParams.page);
  if (rawFilter && LEGACY_QUEUE_FILTER_IDS[rawFilter]) {
    redirect(
      queueHref({
        view: initialViewMode,
        tab: tabId,
        filter: filterId,
        search: initialSearch,
        showFormUnqualified,
        sort,
      }),
    );
  }

  const countBase = { orgId, dead: "hide" as const };
  const allScope = listFiltersForView({
    orgId,
    tabId: "all",
    filterId: tabId === "all" ? filterId : null,
    search: initialSearch,
    showFormUnqualified,
    sort,
  });
  const scopeFilters = listFiltersForView({
    orgId,
    tabId,
    filterId,
    search: initialSearch,
    showFormUnqualified,
    sort,
  });
  const listFilters = {
    ...scopeFilters,
    limit: LEAD_LIST_PAGE_SIZE,
    offset: pageOffset(page),
  };

  const [
    allCount,
    meetingsCount,
    followUpsCount,
    total,
    rows,
    org,
    tableViewBootstrap,
  ] = await Promise.all([
    tabId === "all" ? Promise.resolve(-1) : countLeads(allScope),
    // Badge counts for Meetings / Follow-ups: same as before (no search, no hideFormUnqualified).
    countLeads({ ...countBase, meetingsBookedOnly: true }),
    countLeads({ ...countBase, followUp: ["overdue", "today"] }),
    countLeads(scopeFilters),
    listLeads(listFilters),
    getOrganizationById(orgId),
    loadTableViewBootstrap("leads-queue", { orgId }),
  ]);

  const counts: Record<string, number> = {
    all: tabId === "all" ? total : allCount,
    meetings_booked: meetingsCount,
    follow_ups_due: followUpsCount,
  };

  const activitiesMap = await listRecentLeadActivitiesForLeads(
    rows.map((r) => r.id),
    orgId,
    5,
  );
  const activitiesByLead: Record<string, LeadActivityRow[]> = {};
  for (const [id, list] of activitiesMap) {
    activitiesByLead[id] = list;
  }

  return (
    <DataTablePageShell className="gap-6">
      <PersistFilterState pageKey="leads-queue" />
      <FilterPendingRoot>
        <div className="shrink-0 space-y-3">
          <div>
            <h1 className="page-title">Work Queue</h1>
          </div>

          <WorkQueueControls
            view={initialViewMode}
            tabId={tabId}
            filterId={filterId}
            search={initialSearch}
            showFormUnqualified={showFormUnqualified}
            sort={sort}
            counts={counts}
          />
        </div>

        <WorkQueueView
          key={`${tabId}:${filterId ?? ""}:${showFormUnqualified}:${page}:${initialSearch}:${sort}`}
          initialViewMode={initialViewMode}
          initialSearch={initialSearch}
          activeTabId={tabId}
          statusFilterId={filterId}
          showFormUnqualified={showFormUnqualified}
          sort={sort}
          page={page}
          total={total}
          pageSize={LEAD_LIST_PAGE_SIZE}
          rows={rows}
          activitiesByLead={activitiesByLead}
          orgName={org?.name ?? null}
          tableViewBootstrap={tableViewBootstrap}
        />
      </FilterPendingRoot>
    </DataTablePageShell>
  );
}
