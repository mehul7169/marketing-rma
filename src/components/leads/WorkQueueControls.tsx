"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CustomFilterBuilder from "@/components/leads/CustomFilterBuilder";
import { useFilterPending } from "@/components/leads/FilterPending";
import {
  ChipTextLink,
  FilterChip,
  FilterSearchInput,
  SortIcon,
  ToolbarDivider,
  ghostBtnClass
} from "@/components/leads/FilterToolbar";
import SavedFilterMenu from "@/components/leads/SavedFilterMenu";
import { ToolbarTrailingSlot } from "@/components/leads/ToolbarPortal";
import { useFilterSearch } from "@/components/leads/useFilterSearch";
import type { FilterEnumValueMap } from "@/lib/db/filterEnumValues";
import {
  completeCustomFilter,
  customConditionChipLabel,
  customConditionChipParts,
  customFilterYields,
  isCustomFilterEmpty,
  removeCondition,
  yieldNote,
  type CustomFilter,
  type CustomFilterMatch
} from "@/lib/leads/customFilter";
import type { NamedLeadFilter } from "@/lib/leads/namedFilters";
import {
  QUEUE_SORT_LABELS,
  QUEUE_SORTS,
  QUEUE_STATUS_CHIP_LABELS,
  QUEUE_TABS,
  isQueuePrimaryTab,
  queueHref,
  queueQueryParams,
  type QueueSort,
  type QueueTabId
} from "@/lib/leads/workQueueParams";
import CountUp from "@/components/ui/CountUp";
import TabInk from "@/components/ui/TabInk";
import { formatInteger } from "@/lib/format";

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
  const { pending, start } = useFilterPending();
  const [filterOpen, setFilterOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [seedBlank, setSeedBlank] = useState(false);
  const [addNonce, setAddNonce] = useState(0);
  const [saveRequestKey, setSaveRequestKey] = useState(0);
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

  const searchBox = useFilterSearch({
    urlValue: search,
    onCommit: (q, { isLatest, immediate }) => {
      start(() => {
        if (!isLatest()) return;
        const href = queueHref({ ...current, search: q });
        if (immediate) router.push(href);
        else router.replace(href);
      });
    }
  });

  const filterDisabled = isQueuePrimaryTab(tabId);
  const note = yieldNote(customFilterYields(customFilter));
  const conditions = customFilter?.conditions ?? [];
  const statusChip = filterId ? QUEUE_STATUS_CHIP_LABELS[filterId] : null;
  const activeCount =
    conditions.length +
    (showFormUnqualified && !filterDisabled ? 1 : 0) +
    (filterId ? 1 : 0);
  const hasChips =
    conditions.length > 0 ||
    Boolean(statusChip) ||
    (showFormUnqualified && !filterDisabled);
  const match: CustomFilterMatch = customFilter?.match === "any" ? "any" : "all";

  function openFilter(opts: { add?: boolean; focusId?: string | null } = {}) {
    setFocusId(opts.focusId ?? null);
    if (opts.add && filterOpen) {
      setAddNonce((n) => n + 1);
      return;
    }
    setSeedBlank(Boolean(opts.add) || isCustomFilterEmpty(customFilter));
    setFilterOpen(true);
  }

  function applyCustom(next: CustomFilter | null) {
    const ready = completeCustomFilter(next);
    go({ customFilter: ready });
  }

  return (
    <div className="space-y-2" data-testid="queue-controls">
      <div
        className="flex flex-wrap items-end gap-x-6 border-b border-subtle"
        role="tablist"
        aria-label="Work Queue tabs"
      >
        {QUEUE_TABS.map((tab) => {
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
              className={`relative -mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-0.5 pb-2 text-sm ${
                active ? "font-medium text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {tab.label}
              <span
                data-testid={`queue-count-${tab.id}`}
                className="tabular-nums text-muted"
              >
                <CountUp
                  value={counts[tab.id] ?? 0}
                  format={formatInteger}
                  speed="badge"
                />
              </span>
              <TabInk active={active} layoutId="queue-tabs-ink" />
            </a>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSearchInput
          testId="work-queue-search"
          labelledBy="work-queue-search-label"
          label="Search leads"
          placeholder="Search name, email, or phone"
          value={searchBox.draft}
          onChange={searchBox.onChange}
          onEnter={searchBox.onEnter}
          pending={pending}
        />
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1 max-md:w-full">
          <CustomFilterBuilder
            filter={customFilter}
            customKeys={customKeys}
            enumValues={enumValues}
            onApply={applyCustom}
            open={filterOpen}
            onOpenChange={(next) => {
              if (next) openFilter({ add: isCustomFilterEmpty(customFilter) });
              else setFilterOpen(false);
            }}
            focusConditionId={focusId}
            seedBlank={seedBlank}
            addNonce={addNonce}
            activeCount={activeCount}
            showFormUnqualified={showFormUnqualified}
            onShowFormUnqualifiedChange={
              filterDisabled ? undefined : (next) => go({ showFormUnqualified: next })
            }
            formUnqualifiedEnabled={!filterDisabled}
          />
          <label className={`${ghostBtnClass} cursor-pointer`} title="Sort">
            <SortIcon />
            <select
              data-testid="queue-sort"
              aria-label="Sort"
              className="h-8 max-w-[9.5rem] cursor-pointer border-0 bg-transparent text-sm text-muted max-[1024px]:sr-only"
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
          <SavedFilterMenu
            pageKey="leads-queue"
            items={namedFilters}
            canManageShared={canManageShared}
            currentQuery={queueQueryParams(current)}
            saveRequestKey={saveRequestKey}
          />
          <ToolbarDivider />
          <ToolbarTrailingSlot />
        </div>
      </div>

      {hasChips ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {conditions.length >= 2 ? (
            <button
              type="button"
              data-testid="cf-match-prefix"
              className="text-xs text-muted hover:text-fg"
              onClick={() =>
                go({
                  customFilter: customFilter
                    ? { ...customFilter, match: match === "all" ? "any" : "all" }
                    : null
                })
              }
            >
              Where {match} of:
            </button>
          ) : null}
          {statusChip && filterId ? (
            <FilterChip
              testId={`filter-chip-status:${filterId}`}
              field={statusChip.field}
              rest={statusChip.rest}
              removeLabel={`Remove ${statusChip.field} ${statusChip.rest}`}
              onEdit={() => openFilter()}
              onRemove={() => go({ filter: null })}
            />
          ) : null}
          {conditions.map((c) => {
            const parts = customConditionChipParts(c);
            return (
              <FilterChip
                key={c.id}
                testId={`filter-chip-cf:${c.id}`}
                field={parts.field}
                rest={parts.rest}
                removeLabel={`Remove ${customConditionChipLabel(c)}`}
                onEdit={() => openFilter({ focusId: c.id })}
                onRemove={() => {
                  const next = removeCondition(customFilter!, c.id);
                  go({ customFilter: isCustomFilterEmpty(next) ? null : next });
                }}
              />
            );
          })}
          {showFormUnqualified && !filterDisabled ? (
            <FilterChip
              testId="filter-chip-unqualified"
              field="Include form-unqualified"
              rest=""
              removeLabel="Remove Include form-unqualified"
              onEdit={() => openFilter()}
              onRemove={() => go({ showFormUnqualified: false })}
            />
          ) : null}
          <ChipTextLink testId="cf-add-filter" onClick={() => openFilter({ add: true })}>
            + Add filter
          </ChipTextLink>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <ChipTextLink onClick={() => setSaveRequestKey((n) => n + 1)}>Save view</ChipTextLink>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <ChipTextLink
            onClick={() =>
              go({
                filter: null,
                customFilter: null,
                showFormUnqualified: false,
                search: ""
              })
            }
          >
            Clear
          </ChipTextLink>
        </div>
      ) : null}
      {note ? (
        <p className="text-xs text-muted" data-testid="cf-yield-note">
          {note}
        </p>
      ) : null}
    </div>
  );
}
