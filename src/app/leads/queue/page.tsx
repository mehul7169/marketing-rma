import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import WorkQueueView from "@/components/table-views/WorkQueueView";
import { DataTablePageShell } from "@/components/table-views/ScrollableDataTable";
import { listRecentLeadActivitiesForLeads } from "@/lib/db/lead_activities";
import { listLeads } from "@/lib/db/leads";
import { getOrganizationById } from "@/lib/db/organizations";
import type { ActionStatus } from "@/lib/leads/actionStatus";
import type { LeadActivityRow } from "@/lib/db/lead_activities";
import { loadTableViewBootstrap } from "@/lib/table-views/loadBootstrap";

const TABS: Array<{
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
  {
    id: "follow_up_due",
    label: "Follow-up Due",
    actionStatuses: ["Follow-up Due"]
  },
  {
    id: "follow_up_overdue",
    label: "Follow-up Overdue",
    actionStatuses: ["Follow-up Overdue"]
  },
  { id: "upcoming", label: "Upcoming", upcomingOnly: true }
];

export default async function WorkQueuePage({
  searchParams
}: {
  searchParams: { tab?: string; view?: string };
}) {
  const orgId = await getCurrentOrgId();
  const tabId = searchParams.tab ?? "untouched";
  const initialViewMode = searchParams.view === "table" ? "table" : "cards";
  const activeTab = TABS.find((t) => t.id === tabId) ?? TABS[0];

  const countBase = { orgId, excludeDeadAndClosed: true as const };

  const [
    untouched,
    contacted,
    due,
    overdue,
    upcoming,
    rows,
    org,
    tableViewBootstrap
  ] = await Promise.all([
    listLeads({ ...countBase, actionStatuses: ["Untouched"] }),
    listLeads({ ...countBase, actionStatuses: ["Personally Contacted"] }),
    listLeads({ ...countBase, actionStatuses: ["Follow-up Due"] }),
    listLeads({ ...countBase, actionStatuses: ["Follow-up Overdue"] }),
    listLeads({ ...countBase, upcomingOnly: true }),
    listLeads({
      ...countBase,
      actionStatuses: activeTab.actionStatuses,
      upcomingOnly: activeTab.upcomingOnly
    }),
    getOrganizationById(orgId),
    loadTableViewBootstrap("leads-queue", { orgId })
  ]);

  const counts: Record<string, number> = {
    untouched: untouched.length,
    personally_contacted: contacted.length,
    follow_up_due: due.length,
    follow_up_overdue: overdue.length,
    upcoming: upcoming.length
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
      <div className="shrink-0 space-y-4">
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

        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <a
              key={tab.id}
              href={`/leads/queue?tab=${tab.id}&view=${initialViewMode}`}
              className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm ${
                activeTab.id === tab.id
                  ? "ui-active"
                  : "border-slate-200 text-slate-700"
              }`}
            >
              {tab.label}
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {counts[tab.id] ?? 0}
              </span>
            </a>
          ))}
        </div>
      </div>

      <WorkQueueView
        key={activeTab.id}
        initialViewMode={initialViewMode}
        activeTabId={activeTab.id}
        rows={rows}
        activitiesByLead={activitiesByLead}
        orgName={org?.name ?? null}
        tableViewBootstrap={tableViewBootstrap}
      />
    </DataTablePageShell>
  );
}
