import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import WorkQueueStatusFilter from "@/components/leads/WorkQueueStatusFilter";
import WorkQueueView from "@/components/table-views/WorkQueueView";
import { DataTablePageShell } from "@/components/table-views/ScrollableDataTable";
import { listRecentLeadActivitiesForLeads } from "@/lib/db/lead_activities";
import { countLeads, listLeads } from "@/lib/db/leads";
import { getOrganizationById } from "@/lib/db/organizations";
import type { ActionStatus } from "@/lib/leads/actionStatus";
import type { LeadActivityRow } from "@/lib/db/lead_activities";
import {
  LEAD_LIST_PAGE_SIZE,
  pageOffset,
  parsePageParam
} from "@/lib/leads/pagination";
import type { LeadListFilters } from "@/lib/leads/types";
import { loadTableViewBootstrap } from "@/lib/table-views/loadBootstrap";

/** Primary tabs — revisited throughout the day. */
const TABS: Array<{
  id: "meetings_booked" | "follow_ups_due";
  label: string;
}> = [
  { id: "meetings_booked", label: "Meetings Booked" },
  { id: "follow_ups_due", label: "Follow-ups Due" }
];

/** Narrow the default (all active) queue on demand — not permanent tabs. */
const STATUS_FILTERS: Array<{
  id: string;
  label: string;
  actionStatuses?: ActionStatus[];
  upcomingOnly?: boolean;
}> = [
  { id: "untouched", label: "Untouched", actionStatuses: ["Untouched"] },
  {
    id: "personally_contacted",
    label: "Personally Contacted",
    actionStatuses: ["Personally Contacted"]
  },
  { id: "upcoming", label: "Upcoming", upcomingOnly: true }
];

function queueHref(opts: {
  view: string;
  tab?: string | null;
  filter?: string | null;
  search?: string;
  page?: number;
}): string {
  const params = new URLSearchParams();
  params.set("view", opts.view);
  if (opts.tab) params.set("tab", opts.tab);
  if (opts.filter) params.set("filter", opts.filter);
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  return `/leads/queue?${params.toString()}`;
}

function listFiltersForView(
  orgId: string,
  tabId: string | null,
  filterId: string | null,
  search: string
): LeadListFilters {
  const base: LeadListFilters = {
    orgId,
    excludeDeadAndClosed: true,
    search: search || undefined
  };
  if (tabId === "meetings_booked") {
    return { ...base, meetingsBookedOnly: true };
  }
  if (tabId === "follow_ups_due") {
    return {
      ...base,
      actionStatuses: ["Follow-up Due", "Follow-up Overdue"]
    };
  }
  const filter = STATUS_FILTERS.find((f) => f.id === filterId);
  if (filter) {
    return {
      ...base,
      actionStatuses: filter.actionStatuses,
      upcomingOnly: filter.upcomingOnly
    };
  }
  return base;
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
  };
}) {
  const orgId = await getCurrentOrgId();
  const rawTab = searchParams.tab?.trim() || "";
  const tabId =
    rawTab === "meetings_booked" || rawTab === "follow_ups_due" ? rawTab : null;
  const filterId = tabId
    ? null
    : STATUS_FILTERS.some((f) => f.id === searchParams.filter)
      ? (searchParams.filter as string)
      : null;
  const initialViewMode = searchParams.view === "cards" ? "cards" : "table";
  const initialSearch = (searchParams.search ?? "").trim();
  const page = parsePageParam(searchParams.page);

  const countBase = { orgId, excludeDeadAndClosed: true as const };
  const scopeFilters = listFiltersForView(orgId, tabId, filterId, initialSearch);
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
    countLeads({
      ...countBase,
      actionStatuses: ["Follow-up Due", "Follow-up Overdue"]
    }),
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
      <div className="shrink-0 space-y-3">
        <div>
          <h1 className="page-title">Work Queue</h1>
          <p className="mt-1 text-sm text-slate-600">
            Active calling queue — dead and closed leads are hidden.{" "}
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
                          search: initialSearch
                        })
                      : queueHref({
                          view: initialViewMode,
                          tab: tab.id,
                          search: initialSearch
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
        </div>
      </div>

      <WorkQueueView
        key={`${tabId ?? "all"}:${filterId ?? ""}:${page}:${initialSearch}`}
        initialViewMode={initialViewMode}
        initialSearch={initialSearch}
        activeTabId={tabId ?? "all"}
        statusFilterId={filterId}
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
