/**
 * /deals URL <-> list filters. Open defaults to any time so old open deals
 * never drop off; Won/Lost/All use a rolling last-60-days window.
 */

import {
  parseCustomFilterParam,
  encodeCustomFilter,
  isCustomFilterEmpty,
  type CustomFilter
} from "@/lib/leads/customFilter";
import type { LeadListFilters } from "@/lib/leads/types";
import { addIstCalendarDays, todayISTDateString } from "@/lib/timezone";
import { DEAL_STAGES } from "@/lib/deals/dealLifecycle";

export const DEAL_TABS = [
  { id: "open", label: "Open" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
  { id: "all", label: "All" }
] as const;
export type DealTabId = (typeof DEAL_TABS)[number]["id"];

export const DEAL_SORTS = ["due", "showed_newest", "closed_newest", "closed_oldest", "value"] as const;
export type DealSort = (typeof DEAL_SORTS)[number];

export const DEAL_METRICS = ["overdue", "today", "needs_next_step"] as const;
export type DealMetricId = (typeof DEAL_METRICS)[number];

export const DEAL_DATE_RANGE_DAYS = 60;

export function parseDealTab(raw?: string | null): DealTabId {
  if (raw === "won" || raw === "lost" || raw === "all") return raw;
  return "open";
}

export function parseDealSort(raw: string | null | undefined, tab: DealTabId): DealSort {
  if (raw === "showed_newest" || raw === "closed_newest" || raw === "closed_oldest" || raw === "value") {
    return raw;
  }
  return tab === "open" ? "due" : "closed_newest";
}

export function parseDealMetric(raw?: string | null): DealMetricId | null {
  if (raw === "overdue" || raw === "today" || raw === "needs_next_step") return raw;
  return null;
}

export function parseDealStages(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  const allowed = new Set<string>(["showed_up", ...DEAL_STAGES]);
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => allowed.has(s));
}

export function parseOwnerParam(raw?: string | null): string | "unassigned" | "me" | null {
  if (!raw?.trim()) return null;
  if (raw === "unassigned" || raw === "me") return raw;
  return raw.trim();
}

export type DealHrefOpts = {
  tab?: DealTabId | string | null;
  owner?: string | null;
  stage?: string | null;
  search?: string;
  sort?: string | null;
  metric?: string | null;
  from?: string | null;
  to?: string | null;
  customFilter?: CustomFilter | null;
};

export function dealHref(opts: DealHrefOpts): string {
  const params = new URLSearchParams();
  const tab = parseDealTab(opts.tab ?? null);
  if (tab !== "open") params.set("tab", tab);
  if (opts.owner) params.set("owner", opts.owner);
  if (opts.stage) params.set("stage", opts.stage);
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  const sort = parseDealSort(opts.sort ?? null, tab);
  if (tab === "open" && sort !== "due") params.set("sort", sort);
  if (tab !== "open" && sort !== "closed_newest") params.set("sort", sort);
  if (opts.metric) params.set("metric", opts.metric);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  const cf = opts.customFilter ? encodeCustomFilter(opts.customFilter) : null;
  if (cf) params.set("cf", cf);
  const q = params.toString();
  return q ? `/deals?${q}` : "/deals";
}

export function dealQueryParams(opts: DealHrefOpts): Record<string, string> {
  const qs = dealHref(opts).split("?")[1] ?? "";
  return Object.fromEntries(new URLSearchParams(qs));
}

export function rollingFromISO(todayISO: string, days = DEAL_DATE_RANGE_DAYS): string {
  return addIstCalendarDays(todayISO, -(days - 1));
}

export type DealListView = {
  tabId: DealTabId;
  owner: string | "unassigned" | "me" | null;
  stages: string[];
  search: string;
  sort: DealSort;
  metric: DealMetricId | null;
  fromISO: string | null;
  toISO: string | null;
  customFilter: CustomFilter | null;
};

export function parseDealSearchParams(searchParams: {
  tab?: string;
  owner?: string;
  stage?: string;
  search?: string;
  sort?: string;
  metric?: string;
  from?: string;
  to?: string;
  cf?: string;
}): DealListView {
  const tabId = parseDealTab(searchParams.tab);
  const from = searchParams.from?.trim() || null;
  const to = searchParams.to?.trim() || null;
  return {
    tabId,
    owner: parseOwnerParam(searchParams.owner),
    stages: parseDealStages(searchParams.stage),
    search: (searchParams.search ?? "").trim(),
    sort: parseDealSort(searchParams.sort, tabId),
    metric: tabId === "open" ? parseDealMetric(searchParams.metric) : null,
    fromISO: from,
    toISO: to,
    customFilter: parseCustomFilterParam(searchParams.cf)
  };
}

export function listFiltersForDeals(opts: {
  orgId: string;
  view: DealListView;
  actorUserId: string | null;
  todayISO?: string;
}): LeadListFilters {
  const today = opts.todayISO ?? todayISTDateString();
  const { view } = opts;
  const ownerResolved =
    view.owner === "me" ? opts.actorUserId : view.owner;
  const filters: LeadListFilters = {
    orgId: opts.orgId,
    showedOnly: true,
    search: view.search || undefined,
    customFilter: isCustomFilterEmpty(view.customFilter) ? undefined : view.customFilter ?? undefined,
    dealStages: view.stages.length ? view.stages : undefined,
    ownerId: ownerResolved || undefined
  };
  if (view.tabId === "open") {
    filters.dealStatus = "open";
    filters.dealMetric = view.metric ?? undefined;
  } else if (view.tabId === "won") {
    filters.dealStatus = "won";
    filters.dateField = "closed_at";
  } else if (view.tabId === "lost") {
    filters.dealStatus = "lost";
    filters.dateField = "closed_at";
  } else {
    filters.dateField = "call_showed_at";
  }

  if (view.tabId === "open") {
    if (view.fromISO && view.toISO) {
      filters.dateField = "call_showed_at";
      filters.fromISO = view.fromISO;
      filters.toISO = view.toISO;
    }
  } else if (view.fromISO && view.toISO) {
    filters.fromISO = view.fromISO;
    filters.toISO = view.toISO;
  } else {
    filters.fromISO = rollingFromISO(today);
    filters.toISO = today;
  }

  if (view.tabId !== "open") {
    if (view.sort === "closed_oldest") filters.sort = "closed_oldest";
    else if (view.sort === "value") filters.sort = "value";
    else filters.sort = "closed";
  } else if (view.sort === "showed_newest") {
    filters.dateField = "call_showed_at";
    filters.sort = "date";
  } else {
    filters.sort = "follow_up";
  }
  return filters;
}

export const DEAL_SORT_LABELS: Record<DealSort, string> = {
  due: "Due",
  showed_newest: "Newest showed",
  closed_newest: "Newest closed",
  closed_oldest: "Oldest closed",
  value: "Highest value"
};

export function dealSortsForTab(tab: DealTabId): DealSort[] {
  return tab === "open" ? ["due", "showed_newest"] : ["closed_newest", "closed_oldest", "value"];
}

export function overdueDealsFilters(orgId: string): LeadListFilters {
  return {
    orgId,
    showedOnly: true,
    dealStatus: "open",
    dealMetric: "overdue"
  };
}
