import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import { redirect } from "next/navigation";
import WorkQueueStatusFilter from "@/components/leads/WorkQueueStatusFilter";
import WorkQueueView from "@/components/table-views/WorkQueueView";
import { DataTablePageShell } from "@/components/table-views/ScrollableDataTable";
import { listRecentLeadActivitiesForLeads } from "@/lib/db/lead_activities";
import { countLeads, listLeads } from "@/lib/db/leads";
import { getOrganizationById } from "@/lib/db/organizations";
import type { LeadActivityRow } from "@/lib/db/lead_activities";
import {
  LEAD_LIST_PAGE_SIZE,
  pageOffset,
  parsePageParam
} from "@/lib/leads/pagination";
import type { LeadListFilters } from "@/lib/leads/types";
import PersistFilterState from "@/components/table-views/PersistFilterState";
import {
  loadTableViewBootstrap,
  restorePersistedFilters
} from "@/lib/table-views/loadBootstrap";

/** Primary tabs — revisited throughout the day. */
const TABS: Array<{
  id: "meetings_booked" | "follow_ups_due";
  label: string;
}> = [
  { id: "meetings_booked", label: "Meetings Booked" },
  { id: "follow_ups_due", label: "Follow-ups" }
];

/** Narrow the default queue on demand — not permanent tabs. */
const STATUS_FILTERS: Array<{ id: string; filters: Partial<LeadListFilters> }> = [
  { id: "new", filters: { pipelineStages: ["new"] } },
  { id: "contacted", filters: { pipelineStages: ["contacted"] } },
  { id: "upcoming", filters: { followUp: ["upcoming"] } }
];

/** Saved queue state from before the Stage rename. */
const LEGACY_FILTER_IDS: Record<string, string> = {
  untouched: "new",
  personally_contacted: "contacted"
};

function queueHref(opts: {
  view: string;
  tab?: string | null;
  filter?: string | null;
  search?: string;
  showFormUnqualified?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set("view", opts.view);
  if (opts.tab) params.set("tab", opts.tab);
  if (opts.filter) params.set("filter", opts.filter);
  if (opts.showFormUnqualified) params.set("show_unqualified", "1");
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  return `/leads/queue?${params.toString()}`;
}

function listFiltersForView(
  orgId: string,
  tabId: string | null,
  filterId: string | null,
  search: string,
  showFormUnqualified: boolean
): LeadListFilters {
  const base: LeadListFilters = {
    orgId,
    dead: "hide",
    sort: "queue",
    search: search || undefined
  };
  if (tabId === "meetings_booked") return { ...base, meetingsBookedOnly: true };
  if (tabId === "follow_ups_due") return { ...base, followUp: ["overdue", "today"] };
  const filter = STATUS_FILTERS.find((f) => f.id === filterId);
  return {
    ...base,
    hideFormUnqualified: !showFormUnqualified,
    ...filter?.filters
  };
}

export default async function WorkQueuePage({
  searchParams
}: {
  searchParams: {
    tab?: string;
    filter?: string;
    view?: string;
    search?: string;
    page?: string;
    show_unqualified?: string;
  };
}) {
  const orgId = await getCurrentOrgId();
  await restorePersistedFilters("leads-queue", "/leads/queue", searchParams, orgId);
  const rawTab = searchParams.tab?.trim() || "";
  const tabId =
    rawTab === "meetings_booked" || rawTab === "follow_ups_due" ? rawTab : null;
  const rawFilter = searchParams.filter?.trim() ?? "";
  const mappedFilter = LEGACY_FILTER_IDS[rawFilter] ?? rawFilter;
  const filterId = tabId
    ? null
    : STATUS_FILTERS.some((f) => f.id === mappedFilter)
      ? mappedFilter
      : null;
  const showFormUnqualified = searchParams.show_unqualified === "1";
  const initialViewMode = searchParams.view === "cards" ? "cards" : "table";
  const initialSearch = (searchParams.search ?? "").trim();
  const page = parsePageParam(searchParams.page);
  if (rawFilter && LEGACY_FILTER_IDS[rawFilter]) {
    redirect(
      queueHref({
        view: initialViewMode,
        tab: tabId,
        filter: mappedFilter,
        search: initialSearch,
        showFormUnqualified
      })
    );
  }

  const countBase: LeadListFilters = { orgId, dead: "hide" };
  const scopeFilters = listFiltersForView(
    orgId,
    tabId,
    filterId,
    initialSearch,
    showFormUnqualified
  );
  const listFilters: LeadListFilters = {
    ...scopeFilters,
    limit: LEAD_LIST_PAGE_SIZE,
    offset: pageOffset(page)
  };

  const [
    meetingsCount,
    followUpsCount,
    total,
    rows,
    org,
    tableViewBootstrap
  ] = await Promise.all([
    // Badge counts: lightweight count(*), not the paged row set.
    countLeads({ ...countBase, meetingsBookedOnly: true }),
    countLeads({ ...countBase, followUp: ["overdue", "today"] }),
    countLeads(scopeFilters),
    listLeads(listFilters),
    getOrganizationById(orgId),
    loadTableViewBootstrap("leads-queue", { orgId })
  ]);

  const counts: Record<string, number> = {
    meetings_booked: meetingsCount,
    follow_ups_due: followUpsCount
  };

  const activitiesMap = await listRecentLeadActivitiesForLeads(
    rows.map((r) => r.id),
    orgId,
    5
  );
  const activitiesByLead: Record<string, LeadActivityRow[]> = {};
  for (const [id, list] of activitiesMap) {
    activitiesByLead[id] = list;
  }

  return (
    <DataTablePageShell className="gap-6">
      <PersistFilterState pageKey="leads-queue" />
      <div className="shrink-0 space-y-3">
        <div>
          <h1 className="page-title">Work Queue</h1>
          <p className="mt-1 text-sm text-slate-600">
            Calling queue — dead leads are hidden
            {showFormUnqualified || tabId ? "" : ", and so are form-unqualified leads with no setter decision"}
            .{" "}
            <a
              href="/leads"
              className="underline decoration-slate-300 hover:text-slate-900"
            >
              Browse all leads
            </a>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex overflow-hidden rounded-sm border border-sky-200"
            role="tablist"
            aria-label="Work Queue tabs"
          >
            {TABS.map((tab, i) => {
              const active = tabId === tab.id;
              return (
                <a
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  href={
                    active
                      ? queueHref({
                          view: initialViewMode,
                          search: initialSearch,
                          showFormUnqualified
                        })
                      : queueHref({
                          view: initialViewMode,
                          tab: tab.id,
                          search: initialSearch,
                          showFormUnqualified
                        })
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs ${
                    i > 0 ? "border-l border-sky-200" : ""
                  } ${
                    active
                      ? "bg-sky-100 font-medium text-sky-950"
                      : "bg-sky-50/60 text-sky-900 hover:bg-sky-100/80"
                  }`}
                >
                  {tab.label}
                  <span className="rounded-sm border border-sky-200/80 bg-white/80 px-1 py-px text-[10px] tabular-nums text-sky-800">
                    {counts[tab.id] ?? 0}
                  </span>
                </a>
              );
            })}
          </div>

          <WorkQueueStatusFilter
            view={initialViewMode}
            value={filterId}
            search={initialSearch}
            disabled={Boolean(tabId)}
          />

          {tabId ? null : (
          <a
            href={queueHref({
              view: initialViewMode,
              filter: filterId,
              search: initialSearch,
              showFormUnqualified: !showFormUnqualified
            })}
            aria-pressed={showFormUnqualified}
            className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs ${
              showFormUnqualified
                ? "border-slate-400 bg-slate-100 text-slate-900"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <input type="checkbox" readOnly checked={showFormUnqualified} className="h-3 w-3" tabIndex={-1} />
            Show form-unqualified
          </a>
          )}
        </div>
      </div>

      <WorkQueueView
        key={`${tabId ?? "all"}:${filterId ?? ""}:${showFormUnqualified}:${page}:${initialSearch}`}
        initialViewMode={initialViewMode}
        initialSearch={initialSearch}
        activeTabId={tabId ?? "all"}
        statusFilterId={filterId}
        showFormUnqualified={showFormUnqualified}
        page={page}
        total={total}
        pageSize={LEAD_LIST_PAGE_SIZE}
        rows={rows}
        activitiesByLead={activitiesByLead}
        orgName={org?.name ?? null}
        tableViewBootstrap={tableViewBootstrap}
      />
    </DataTablePageShell>
  );
}
