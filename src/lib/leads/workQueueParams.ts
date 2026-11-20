/**
 * Work Queue URL <-> list filters. Single path for tabs, sort, hrefs and
 * persistence so the All count, pagination and saved view can't drift.
 */

import {
  customFilterYields,
  encodeCustomFilter,
  isCustomFilterEmpty,
  parseCustomFilterParam,
  type CustomFilter
} from "@/lib/leads/customFilter";
import type { LeadListFilters } from "@/lib/leads/types";

export const QUEUE_TABS = [
  { id: "all", label: "All" },
  { id: "meetings_booked", label: "Meetings booked" },
  { id: "follow_ups_due", label: "Follow-ups" }
] as const;

export type QueueTabId = (typeof QUEUE_TABS)[number]["id"];

export const QUEUE_SORTS = ["newest", "oldest", "follow_up"] as const;
export type QueueSort = (typeof QUEUE_SORTS)[number];

export const QUEUE_SORT_LABELS: Record<QueueSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  follow_up: "Follow-up due"
};

/** Narrow the All tab on demand — mutually exclusive with Meetings / Follow-ups. */
export const QUEUE_STATUS_FILTERS: Array<{
  id: string;
  filters: Partial<LeadListFilters>;
}> = [
  { id: "new", filters: { pipelineStages: ["new"] } },
  { id: "contacted", filters: { pipelineStages: ["contacted"] } },
  { id: "upcoming", filters: { followUp: ["upcoming"] } }
];

export const QUEUE_STATUS_CHIP_LABELS: Record<string, { field: string; rest: string }> = {
  new: { field: "Stage", rest: "is New" },
  contacted: { field: "Stage", rest: "is Contacted" },
  upcoming: { field: "Follow-up", rest: "is Upcoming" }
};

/** Saved queue state from before the Stage rename. */
export const LEGACY_QUEUE_FILTER_IDS: Record<string, string> = {
  untouched: "new",
  personally_contacted: "contacted"
};

export function parseQueueTab(raw?: string | null): QueueTabId {
  if (raw === "meetings_booked" || raw === "follow_ups_due") return raw;
  return "all";
}

export function parseQueueSort(raw?: string | null): QueueSort {
  if (raw === "oldest" || raw === "follow_up") return raw;
  if (raw === "queue") return "follow_up";
  return "newest";
}

export function parseQueueFilter(
  raw: string | undefined | null,
  tabId: QueueTabId
): string | null {
  if (tabId !== "all") return null;
  const mapped = LEGACY_QUEUE_FILTER_IDS[raw ?? ""] ?? (raw ?? "").trim();
  return QUEUE_STATUS_FILTERS.some((f) => f.id === mapped) ? mapped : null;
}

export function isQueuePrimaryTab(tabId: QueueTabId): boolean {
  return tabId === "meetings_booked" || tabId === "follow_ups_due";
}

export type QueueHrefOpts = {
  view: string;
  tab?: string | null;
  filter?: string | null;
  search?: string;
  showFormUnqualified?: boolean;
  sort?: QueueSort | string | null;
  page?: number;
  customFilter?: CustomFilter | null;
};

export function queueHref(opts: QueueHrefOpts): string {
  const params = new URLSearchParams();
  params.set("view", opts.view || "table");
  const tab = opts.tab && opts.tab !== "all" ? opts.tab : "";
  if (tab) params.set("tab", tab);
  if (opts.filter) params.set("filter", opts.filter);
  if (opts.showFormUnqualified) params.set("show_unqualified", "1");
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  const sort = parseQueueSort(opts.sort ?? null);
  if (sort !== "newest") params.set("sort", sort);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const cf = opts.customFilter ? encodeCustomFilter(opts.customFilter) : null;
  if (cf) params.set("cf", cf);
  return `/leads/queue?${params.toString()}`;
}

/** Serializable query map for Pagination (omits empty / default values). */
export function queueQueryParams(opts: QueueHrefOpts): Record<string, string> {
  const qs = queueHref(opts).split("?")[1] ?? "";
  return Object.fromEntries(new URLSearchParams(qs));
}

export function listFiltersForView(opts: {
  orgId: string;
  tabId: QueueTabId;
  filterId: string | null;
  search: string;
  showFormUnqualified: boolean;
  sort: QueueSort;
  customFilter?: CustomFilter | null;
}): LeadListFilters {
  const custom = isCustomFilterEmpty(opts.customFilter) ? undefined : opts.customFilter ?? undefined;
  const yieldBase = customFilterYields(custom);
  const base: LeadListFilters = {
    orgId: opts.orgId,
    dead: yieldBase.dead ? "show" : "hide",
    sort: opts.sort,
    search: opts.search || undefined,
    customFilter: custom
  };
  if (opts.tabId === "meetings_booked") return { ...base, meetingsBookedOnly: true };
  if (opts.tabId === "follow_ups_due") {
    return { ...base, followUp: ["overdue", "today"] };
  }
  const filter = QUEUE_STATUS_FILTERS.find((f) => f.id === opts.filterId);
  return {
    ...base,
    hideFormUnqualified:
      yieldBase.formQualified || yieldBase.dead ? false : !opts.showFormUnqualified,
    ...filter?.filters
  };
}

export { parseCustomFilterParam };
