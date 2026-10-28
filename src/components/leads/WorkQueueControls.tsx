"use client";

import { useRouter } from "next/navigation";
import { useFilterPending } from "@/components/leads/FilterPending";
import WorkQueueStatusFilter from "@/components/leads/WorkQueueStatusFilter";
import {
  QUEUE_SORT_LABELS,
  QUEUE_SORTS,
  QUEUE_TABS,
  isQueuePrimaryTab,
  queueHref,
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
  counts
}: {
  view: string;
  tabId: QueueTabId;
  filterId: string | null;
  search?: string;
  showFormUnqualified: boolean;
  sort: QueueSort;
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const { start } = useFilterPending();
  const current = {
    view,
    tab: tabId === "all" ? null : tabId,
    filter: tabId === "all" ? filterId : null,
    search,
    showFormUnqualified,
    sort
  };

  function go(
    patch: Partial<{
      tab: string | null;
      filter: string | null;
      sort: QueueSort;
      showFormUnqualified: boolean;
    }>
  ) {
    start(() => router.push(queueHref({ ...current, ...patch })));
  }

  const filterDisabled = isQueuePrimaryTab(tabId);

  return (
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
  );
}
