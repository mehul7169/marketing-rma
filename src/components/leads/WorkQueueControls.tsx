"use client";

import { useRouter } from "next/navigation";
import CustomFilterBuilder from "@/components/leads/CustomFilterBuilder";
import { useFilterPending } from "@/components/leads/FilterPending";
import WorkQueueStatusFilter from "@/components/leads/WorkQueueStatusFilter";
import type { FilterEnumValueMap } from "@/lib/db/filterEnumValues";
import {
  customConditionChipLabel,
  customFilterYields,
  isCustomFilterEmpty,
  removeCondition,
  yieldNote,
  type CustomFilter
} from "@/lib/leads/customFilter";
import type { NamedLeadFilter } from "@/lib/leads/namedFilters";
import {
  QUEUE_SORT_LABELS,
  QUEUE_SORTS,
  QUEUE_TABS,
  isQueuePrimaryTab,
  queueHref,
  queueQueryParams,
  type QueueSort,
  type QueueTabId
} from "@/lib/leads/workQueueParams";

function Dot({ className = "" }: { className?: string }) {
  return (
    <span className={`text-slate-300 ${className}`.trim()} aria-hidden="true">
      ·
    </span>
  );
}

export default function WorkQueueControls({
  view,
  tabId,
  filterId,
  search = "",
  showFormUnqualified,
  sort,
  counts,
  customFilter = null,
  customKeys = [],
  enumValues = {},
  namedFilters = [],
  canManageShared = false
}: {
  view: string;
  tabId: QueueTabId;
  filterId: string | null;
  search?: string;
  showFormUnqualified: boolean;
  sort: QueueSort;
  counts: Record<string, number>;
  customFilter?: CustomFilter | null;
  customKeys?: string[];
  enumValues?: FilterEnumValueMap;
  namedFilters?: NamedLeadFilter[];
  canManageShared?: boolean;
}) {
  const router = useRouter();
  const { start } = useFilterPending();
  const current = {
    view,
    tab: tabId === "all" ? null : tabId,
    filter: tabId === "all" ? filterId : null,
    search,
    showFormUnqualified,
    sort,
    customFilter
  };

  function go(
    patch: Partial<{
      tab: string | null;
      filter: string | null;
      sort: QueueSort;
      showFormUnqualified: boolean;
      customFilter: CustomFilter | null;
      search: string;
    }>
  ) {
    start(() => router.push(queueHref({ ...current, ...patch })));
  }

  const filterDisabled = isQueuePrimaryTab(tabId);
  const note = yieldNote(customFilterYields(customFilter));

  return (
    <div className="space-y-2">
    <div
      data-testid="queue-controls"
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
    >
      <div className="max-xl:w-full">
      <div
        className="inline-flex overflow-hidden rounded-sm border border-sky-200"
        role="tablist"
        aria-label="Work Queue tabs"
      >
        {QUEUE_TABS.map((tab, i) => {
          const active = tabId === tab.id;
          const href = queueHref({
            ...current,
            tab: tab.id === "all" ? null : tab.id,
            filter: tab.id === "all" ? current.filter : null
          });
          return (
            <a
              key={tab.id}
              role="tab"
              aria-selected={active}
              data-testid={`queue-tab-${tab.id}`}
              href={href}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                  return;
                }
                e.preventDefault();
                if (active && tab.id === "all") return;
                go({
                  tab: tab.id === "all" ? null : tab.id,
                  filter: tab.id === "all" ? current.filter : null
                });
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs ${
                i > 0 ? "border-l border-sky-200" : ""
              } ${
                active
                  ? "bg-sky-100 font-medium text-sky-950"
                  : "bg-sky-50/60 text-sky-900 hover:bg-sky-100/80"
              }`}
            >
              {tab.label}
              <span
                data-testid={`queue-count-${tab.id}`}
                className="rounded-sm border border-sky-200/80 bg-white/80 px-1 py-px text-[10px] tabular-nums text-sky-800"
              >
                {counts[tab.id] ?? 0}
              </span>
            </a>
          );
        })}
      </div>
      </div>

      <div className="inline-flex items-center gap-x-4">
        <Dot className="max-xl:hidden" />
        <WorkQueueStatusFilter
          value={filterId}
          disabled={filterDisabled}
          onChange={(next) => go({ tab: null, filter: next || null })}
        />
      </div>

      <div className="inline-flex items-center gap-x-4">
        <Dot />
        <CustomFilterBuilder
          pageKey="leads-queue"
          filter={customFilter}
          customKeys={customKeys}
          enumValues={enumValues}
          namedFilters={namedFilters}
          canManageShared={canManageShared}
          currentQuery={queueQueryParams(current)}
          yieldNoteText={null}
          onApply={(next) => go({ customFilter: next })}
        />
      </div>

      <div className="inline-flex items-center gap-x-4">
        <Dot />
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className="whitespace-nowrap">Sort</span>
          <select
            data-testid="queue-sort"
            aria-label="Sort"
            className="rounded-sm border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
            value={sort}
            onChange={(e) => go({ sort: e.target.value as QueueSort })}
          >
            {QUEUE_SORTS.map((id) => (
              <option key={id} value={id}>
                {QUEUE_SORT_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filterDisabled ? null : (
        <div className="inline-flex items-center gap-x-4">
          <Dot />
          <a
            href={queueHref({
              ...current,
              showFormUnqualified: !showFormUnqualified
            })}
            aria-pressed={showFormUnqualified}
            data-testid="queue-show-unqualified"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                return;
              }
              e.preventDefault();
              go({ showFormUnqualified: !showFormUnqualified });
            }}
            className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs ${
              showFormUnqualified
                ? "border-slate-400 bg-slate-100 text-slate-900"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              readOnly
              checked={showFormUnqualified}
              className="h-3 w-3"
              tabIndex={-1}
            />
            Show form-unqualified
          </a>
        </div>
      )}
    </div>
    {!isCustomFilterEmpty(customFilter) || search ? (
      <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
        {search ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-3 pr-1 text-xs">
            Search: {search}
            <button
              type="button"
              className="rounded-full px-1.5 text-slate-500 hover:bg-slate-200"
              onClick={() => go({ search: "" })}
            >
              ×
            </button>
          </span>
        ) : null}
        {(customFilter?.conditions ?? []).map((c) => (
          <span
            key={c.id}
            data-testid={`filter-chip-cf:${c.id}`}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-3 pr-1 text-xs text-slate-800"
          >
            <span className="truncate">{customConditionChipLabel(c)}</span>
            <button
              type="button"
              aria-label={`Remove ${customConditionChipLabel(c)}`}
              className="rounded-full px-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              onClick={() => {
                const next = removeCondition(customFilter!, c.id);
                go({ customFilter: isCustomFilterEmpty(next) ? null : next });
              }}
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          className="text-xs text-slate-500 underline decoration-slate-300 hover:text-slate-900"
          onClick={() =>
            go({
              filter: null,
              customFilter: null,
              showFormUnqualified: false,
              search: ""
            })
          }
        >
          Clear all
        </button>
      </div>
    ) : null}
    {note ? (
      <p className="text-xs text-slate-500" data-testid="cf-yield-note">
        {note}
      </p>
    ) : null}
    </div>
  );
}
