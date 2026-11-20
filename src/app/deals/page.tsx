import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import { getCurrentSession } from "@/lib/auth/session";
import DealsControls from "@/components/deals/DealsControls";
import DealsView from "@/components/deals/DealsView";
import TriageBanner from "@/components/deals/TriageBanner";
import { FilterPendingRoot } from "@/components/leads/FilterPending";
import PersistFilterState from "@/components/table-views/PersistFilterState";
import { DataTablePageShell } from "@/components/table-views/ScrollableDataTable";
import { listRecentLeadActivitiesForLeads } from "@/lib/db/lead_activities";
import { countLeads, listLeads } from "@/lib/db/leads";
import { listMembershipsForOrg } from "@/lib/db/memberships";
import { getOrganizationById } from "@/lib/db/organizations";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import {
  computeDealMetrics,
  istMonthStartDateString
} from "@/lib/deals/dealGroups";
import {
  listFiltersForDeals,
  parseDealSearchParams
} from "@/lib/deals/dealListParams";
import {
  loadFilterBuilderContext,
  restorePersistedFilters
} from "@/lib/table-views/loadBootstrap";
import { todayISTDateString } from "@/lib/timezone";

export default async function DealsPage({
  searchParams
}: {
  searchParams: {
    tab?: string;
    owner?: string;
    stage?: string;
    search?: string;
    sort?: string;
    metric?: string;
    from?: string;
    to?: string;
    cf?: string;
    deal?: string;
  };
}) {
  const orgId = await getCurrentOrgId();
  await restorePersistedFilters("deals", "/deals", searchParams, orgId);
  const session = await getCurrentSession();
  const actorUserId = session?.userId ?? null;
  const view = parseDealSearchParams(searchParams);
  const today = todayISTDateString();
  const listFilters = listFiltersForDeals({
    orgId,
    view,
    actorUserId,
    todayISO: today
  });
  const ownerResolved =
    view.owner === "me" ? actorUserId : view.owner;
  const metricOwner =
    ownerResolved === "unassigned"
      ? ("unassigned" as const)
      : ownerResolved || undefined;

  const [
    openCount,
    wonCount,
    lostCount,
    allCount,
    rows,
    openForMetrics,
    wonThisMonth,
    needsNextStepCount,
    org,
    memberships
  ] = await Promise.all([
    countLeads({ orgId, showedOnly: true, dealStatus: "open" }),
    countLeads({ orgId, showedOnly: true, dealStatus: "won" }),
    countLeads({ orgId, showedOnly: true, dealStatus: "lost" }),
    countLeads({ orgId, showedOnly: true }),
    listLeads(listFilters),
    listLeads({
      orgId,
      showedOnly: true,
      dealStatus: "open",
      ownerId: metricOwner
    }),
    listLeads({
      orgId,
      showedOnly: true,
      dealStatus: "won",
      ownerId: metricOwner,
      dateField: "closed_at",
      fromISO: istMonthStartDateString(),
      toISO: today
    }),
    countLeads({
      orgId,
      showedOnly: true,
      dealStatus: "open",
      dealMetric: "needs_next_step"
    }),
    getOrganizationById(orgId),
    listMembershipsForOrg(orgId)
  ]);
  const filterBuilder = await loadFilterBuilderContext(
    "deals",
    orgId,
    org?.slug ?? null
  );

  const members = memberships
    .filter((m) => m.status === "active" && m.user_id)
    .map((m) => ({ userId: m.user_id as string, email: m.email }));

  const ownerIds = [
    ...new Set(
      [...rows, ...openForMetrics, ...wonThisMonth]
        .map((r) => r.owner_id)
        .filter((id): id is string => Boolean(id))
    )
  ];
  const ownerEmailById = await emailsByProfileId([
    ...ownerIds,
    ...members.map((m) => m.userId)
  ]);

  const activitiesMap = await listRecentLeadActivitiesForLeads(
    rows.map((r) => r.id),
    orgId,
    1
  );
  const actorIds = [
    ...new Set(
      [...activitiesMap.values()].flatMap((list) =>
        list.map((a) => a.created_by).filter((id): id is string => Boolean(id))
      )
    )
  ];
  const activityEmails = await emailsByProfileId(actorIds);
  const lastTouchByLead: Record<
    string,
    { note: string | null; actorEmail: string | null }
  > = {};
  for (const [id, list] of activitiesMap) {
    const a = list[0];
    lastTouchByLead[id] = {
      note: a?.note ?? null,
      actorEmail: a?.created_by ? activityEmails[a.created_by] ?? null : null
    };
  }

  const metrics = computeDealMetrics(openForMetrics, wonThisMonth);
  const counts = {
    open: openCount,
    won: wonCount,
    lost: lostCount,
    all: allCount
  };

  return (
    <DataTablePageShell className="gap-6">
      <PersistFilterState pageKey="deals" />
      <FilterPendingRoot>
        <div className="shrink-0 space-y-3">
          <h1 className="page-title">Deals</h1>
          <DealsControls
            view={view}
            counts={counts}
            metrics={metrics}
            members={members}
            actorUserId={actorUserId}
            customKeys={filterBuilder.customKeys}
            enumValues={filterBuilder.enumValues}
          />
          {view.tabId === "open" && !view.metric ? (
            <TriageBanner orgId={orgId} count={needsNextStepCount} />
          ) : null}
        </div>
        <DealsView
          tabId={view.tabId}
          rows={rows}
          lastTouchByLead={lastTouchByLead}
          ownerEmailById={ownerEmailById}
          members={members}
          actor={{
            userId: actorUserId ?? "",
            email: session?.email ?? ""
          }}
        />
      </FilterPendingRoot>
    </DataTablePageShell>
  );
}

async function emailsByProfileId(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0 || !supabaseAdmin) return {};
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email")
    .in("id", unique);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const r = row as { id: string; email: string | null };
    if (r.email) out[r.id] = r.email;
  }
  return out;
}
