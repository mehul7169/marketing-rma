"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CustomFilterBuilder from "@/components/leads/CustomFilterBuilder";
import { useFilterPending } from "@/components/leads/FilterPending";
import {
  ChipTextLink,
  FilterChip,
  FilterSearchInput,
  SortIcon,
  ghostBtnClass
} from "@/components/leads/FilterToolbar";
import { useFilterSearch } from "@/components/leads/useFilterSearch";
import ActionPopover from "@/components/leads/ActionPopover";
import type { FilterEnumValueMap } from "@/lib/db/filterEnumValues";
import {
  completeCustomFilter,
  customConditionChipLabel,
  customConditionChipParts,
  isCustomFilterEmpty,
  removeCondition,
  type CustomFilter,
  type CustomFilterMatch
} from "@/lib/leads/customFilter";
import {
  DEAL_SORT_LABELS,
  DEAL_TABS,
  dealHref,
  dealSortsForTab,
  parseDealTab,
  rollingFromISO,
  type DealListView,
  type DealMetricId,
  type DealSort,
  type DealTabId
} from "@/lib/deals/dealListParams";
import {
  DEAL_STAGE_LABELS,
  DEAL_STAGES
} from "@/lib/deals/dealLifecycle";
import { formatCurrency, formatInteger } from "@/lib/format";
import CountUp from "@/components/ui/CountUp";
import TabInk from "@/components/ui/TabInk";
import { addIstCalendarDays, todayISTDateString } from "@/lib/timezone";
import type { DealMember } from "@/components/deals/DealQuickActions";
import { actorDisplayName } from "@/lib/deals/dealGroups";
import type { DealMetrics } from "@/lib/deals/dealGroups";

const STAGES: Array<{ id: string; label: string }> = [
  { id: "showed_up", label: "Showed up" },
  ...DEAL_STAGES.map((s) => ({ id: s, label: DEAL_STAGE_LABELS[s] }))
];

export default function DealsControls({
  view,
  counts,
  metrics,
  members,
  actorUserId,
  customKeys = [],
  enumValues = {}
}: {
  view: DealListView;
  counts: Record<DealTabId, number>;
  metrics: DealMetrics;
  members: DealMember[];
  actorUserId: string | null;
  customKeys?: string[];
  enumValues?: FilterEnumValueMap;
}) {
  const router = useRouter();
  const { pending, start } = useFilterPending();
  const [filterOpen, setFilterOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [seedBlank, setSeedBlank] = useState(false);
  const [addNonce, setAddNonce] = useState(0);
  const today = todayISTDateString();

  const current = {
    tab: view.tabId,
    owner: view.owner,
    stage: view.stages.join(",") || null,
    search: view.search,
    sort: view.sort,
    metric: view.metric,
    from: view.fromISO,
    to: view.toISO,
    customFilter: view.customFilter
  };

  function go(patch: Partial<typeof current> & { tab?: string | null }) {
    const next = { ...current, ...patch };
    if (patch.tab && patch.tab !== current.tab) {
      if (!("from" in patch)) {
        next.from = null;
        next.to = null;
      }
      if (parseDealTab(patch.tab) !== "open") next.metric = null;
    }
    start(() =>
      router.push(
        dealHref({
          tab: next.tab,
          owner: next.owner,
          stage: next.stage,
          search: next.search,
          sort: next.sort,
          metric: next.metric,
          from: next.from,
          to: next.to,
          customFilter: next.customFilter
        })
      )
    );
  }

  const searchBox = useFilterSearch({
    urlValue: view.search,
    onCommit: (q, { isLatest, immediate }) => {
      start(() => {
        if (!isLatest()) return;
        const href = dealHref({ ...current, search: q });
        if (immediate) router.push(href);
        else router.replace(href);
      });
    }
  });

  const conditions = view.customFilter?.conditions ?? [];
  const match: CustomFilterMatch =
    view.customFilter?.match === "any" ? "any" : "all";
  const stageChip =
    view.stages.length > 0
      ? view.stages
          .map((s) => STAGES.find((x) => x.id === s)?.label ?? s)
          .join(", ")
      : null;
  const ownerChip = ownerChipLabel(view.owner, members, actorUserId);
  const dateChip = dateChipLabel(view);
  const activeCount =
    conditions.length +
    (view.owner ? 1 : 0) +
    (view.stages.length ? 1 : 0) +
    (view.fromISO && view.toISO ? 1 : 0) +
    (view.metric ? 1 : 0);
  const hasChips =
    conditions.length > 0 ||
    Boolean(view.owner) ||
    view.stages.length > 0 ||
    Boolean(view.fromISO) ||
    Boolean(view.metric);

  function openFilter(opts: { add?: boolean; focusId?: string | null } = {}) {
    setFocusId(opts.focusId ?? null);
    if (opts.add && filterOpen) {
      setAddNonce((n) => n + 1);
      return;
    }
    setSeedBlank(Boolean(opts.add) || isCustomFilterEmpty(view.customFilter));
    setFilterOpen(true);
  }

  const sorts = dealSortsForTab(view.tabId);
  const metricTiles = useMemo(
    () => [
      {
        id: "overdue" as const,
        label: "Overdue",
        value: metrics.overdue,
        className: "text-danger",
        tile: "border-danger-soft bg-danger-soft"
      },
      {
        id: "today" as const,
        label: "Due today",
        value: metrics.dueToday,
        className: "text-fg",
        tile: "border-subtle bg-surface"
      },
      {
        id: "needs_next_step" as const,
        label: "Needs next step",
        value: metrics.needsNextStep,
        className: "text-warning",
        tile: "border-warning-soft bg-warning-soft"
      },
      {
        id: "won_month" as const,
        label: "Won this month",
        value: metrics.wonThisMonth,
        subValue:
          metrics.wonThisMonthValue > 0 ? metrics.wonThisMonthValue : undefined,
        className: "text-fg",
        tile: "border-subtle bg-surface"
      }
    ],
    [metrics]
  );

  return (
    <div className="space-y-2" data-testid="deals-controls">
      <div
        className="flex flex-wrap items-end gap-x-6 border-b border-subtle"
        role="tablist"
        aria-label="Deal status"
      >
        {DEAL_TABS.map((tab) => {
          const active = view.tabId === tab.id;
          return (
            <a
              key={tab.id}
              role="tab"
              aria-selected={active}
              data-testid={`deals-tab-${tab.id}`}
              href={dealHref({ ...current, tab: tab.id, metric: null, from: null, to: null })}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                  return;
                }
                e.preventDefault();
                go({ tab: tab.id, metric: null, from: null, to: null });
              }}
              className={`relative -mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-0.5 pb-2 text-sm ${
                active ? "font-medium text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {tab.label}
              <span
                data-testid={`deals-count-${tab.id}`}
                className="tabular-nums text-muted"
              >
                <CountUp
                  value={counts[tab.id] ?? 0}
                  format={formatInteger}
                  speed="badge"
                />
              </span>
              <TabInk active={active} layoutId="deals-tabs-ink" />
            </a>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSearchInput
          testId="deals-search"
          labelledBy="deals-search-label"
          label="Search deals"
          placeholder="Search name, email, or phone"
          value={searchBox.draft}
          onChange={searchBox.onChange}
          onEnter={searchBox.onEnter}
          pending={pending}
        />
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1 max-md:w-full">
          <label className={`${ghostBtnClass} cursor-pointer`}>
            <span className="max-[1024px]:sr-only">Owner</span>
            <select
              data-testid="deals-owner"
              aria-label="Owner"
              className="h-8 max-w-[9.5rem] cursor-pointer border-0 bg-transparent text-sm text-muted"
              value={view.owner ?? ""}
              onChange={(e) => go({ owner: e.target.value || null })}
            >
              <option value="">Anyone</option>
              <option value="me">My deals</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {actorDisplayName(m.email)}
                </option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
          </label>
          <label className={`${ghostBtnClass} cursor-pointer`}>
            <span className="max-[1024px]:sr-only">Stage</span>
            <select
              data-testid="deals-stage"
              aria-label="Stage"
              className="h-8 max-w-[10rem] cursor-pointer border-0 bg-transparent text-sm text-muted"
              value={view.stages[0] ?? ""}
              onChange={(e) => go({ stage: e.target.value || null })}
            >
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <DateRangeControl
            tab={view.tabId}
            fromISO={view.fromISO}
            toISO={view.toISO}
            today={today}
            onApply={(from, to) => go({ from, to })}
          />
          <CustomFilterBuilder
            filter={view.customFilter}
            customKeys={customKeys}
            enumValues={enumValues}
            onApply={(next) => go({ customFilter: completeCustomFilter(next) })}
            open={filterOpen}
            onOpenChange={(next) => {
              if (next) openFilter({ add: isCustomFilterEmpty(view.customFilter) });
              else setFilterOpen(false);
            }}
            focusConditionId={focusId}
            seedBlank={seedBlank}
            addNonce={addNonce}
            activeCount={activeCount}
            formUnqualifiedEnabled={false}
          />
          <label className={`${ghostBtnClass} cursor-pointer`} title="Sort">
            <SortIcon />
            <select
              data-testid="deals-sort"
              aria-label="Sort"
              className="h-8 max-w-[9.5rem] cursor-pointer border-0 bg-transparent text-sm text-muted max-[1024px]:sr-only"
              value={view.sort}
              onChange={(e) => go({ sort: e.target.value as DealSort })}
            >
              {sorts.map((id) => (
                <option key={id} value={id}>
                  {DEAL_SORT_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {hasChips ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {conditions.length >= 2 ? (
            <button
              type="button"
              className="text-xs text-muted hover:text-fg"
              onClick={() =>
                go({
                  customFilter: view.customFilter
                    ? {
                        ...view.customFilter,
                        match: match === "all" ? "any" : "all"
                      }
                    : null
                })
              }
            >
              Where {match} of:
            </button>
          ) : null}
          {ownerChip ? (
            <FilterChip
              field="Owner"
              rest={ownerChip}
              removeLabel="Remove owner"
              onRemove={() => go({ owner: null })}
            />
          ) : null}
          {stageChip ? (
            <FilterChip
              field="Stage"
              rest={stageChip}
              removeLabel="Remove stage"
              onRemove={() => go({ stage: null })}
            />
          ) : null}
          {dateChip ? (
            <FilterChip
              field={view.tabId === "won" || view.tabId === "lost" ? "Closed" : "Showed up"}
              rest={dateChip}
              removeLabel="Remove date range"
              onRemove={() => go({ from: null, to: null })}
            />
          ) : null}
          {view.metric ? (
            <FilterChip
              field="Metric"
              rest={metricLabel(view.metric)}
              removeLabel="Remove metric"
              onRemove={() => go({ metric: null })}
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
                  const next = removeCondition(view.customFilter!, c.id);
                  go({ customFilter: isCustomFilterEmpty(next) ? null : next });
                }}
              />
            );
          })}
          <ChipTextLink testId="cf-add-filter" onClick={() => openFilter({ add: true })}>
            + Add filter
          </ChipTextLink>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <ChipTextLink
            onClick={() =>
              go({
                owner: null,
                stage: null,
                customFilter: null,
                search: "",
                metric: null,
                from: null,
                to: null
              })
            }
          >
            Clear
          </ChipTextLink>
        </div>
      ) : null}

      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        data-testid="deals-metrics"
      >
        {metricTiles.map((t) => {
          const active =
            t.id === "won_month"
              ? view.tabId === "won" && view.fromISO === monthStart(today)
              : view.metric === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-testid={`deals-metric-${t.id}`}
              onClick={() => {
                if (t.id === "won_month") {
                  go({
                    tab: "won",
                    metric: null,
                    from: monthStart(today),
                    to: today
                  });
                  return;
                }
                go({
                  tab: "open",
                  metric: (view.metric === t.id ? null : t.id) as DealMetricId | null
                });
              }}
              className={`pressable lift-card rounded border px-3 py-2 text-left ${t.tile} ${
                active ? "ring-1 ring-fg" : ""
              }`}
            >
              <div className="text-[11px] text-muted">{t.label}</div>
              <div className={`text-lg font-semibold tabular-nums ${t.className}`}>
                <CountUp value={t.value} format={formatInteger} />
              </div>
              {t.subValue != null ? (
                <div className="text-[11px] text-muted">
                  <CountUp value={t.subValue} format={formatCurrency} />
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function monthStart(today: string): string {
  return `${today.slice(0, 8)}01`;
}

function metricLabel(id: DealMetricId): string {
  if (id === "overdue") return "Overdue";
  if (id === "today") return "Due today";
  return "Needs next step";
}

function ownerChipLabel(
  owner: DealListView["owner"],
  members: DealMember[],
  actorUserId: string | null
): string | null {
  if (!owner) return null;
  if (owner === "me") {
    const me = members.find((m) => m.userId === actorUserId);
    return me ? `My deals (${actorDisplayName(me.email)})` : "My deals";
  }
  if (owner === "unassigned") return "Unassigned";
  const m = members.find((x) => x.userId === owner);
  return m ? actorDisplayName(m.email) : "Owner";
}

function dateChipLabel(view: DealListView): string | null {
  if (view.fromISO && view.toISO) return `${view.fromISO} – ${view.toISO}`;
  return null;
}

function DateRangeControl({
  tab,
  fromISO,
  toISO,
  today,
  onApply
}: {
  tab: DealTabId;
  fromISO: string | null;
  toISO: string | null;
  today: string;
  onApply: (from: string | null, to: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const implicit =
    !fromISO && !toISO && tab !== "open"
      ? { from: rollingFromISO(today), to: today }
      : null;
  const from = fromISO ?? implicit?.from ?? "";
  const to = toISO ?? implicit?.to ?? "";
  const label =
    tab === "open" && !fromISO
      ? "Any time"
      : from && to
        ? `${from} – ${to}`
        : "Dates";
  const field = tab === "won" || tab === "lost" ? "Closed" : "Showed up";

  return (
    <ActionPopover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      widthClass="w-72"
      trigger={
        <button
          type="button"
          data-testid="deals-date-range"
          className={ghostBtnClass}
        >
          {field}
          <span className="max-[1024px]:hidden text-muted">{label}</span>
        </button>
      }
    >
      <div className="space-y-2" data-testid="deals-date-popover">
        {tab === "open" ? (
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2"
            onClick={() => {
              onApply(null, null);
              setOpen(false);
            }}
          >
            Any time
          </button>
        ) : null}
        <button
          type="button"
          className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2"
          onClick={() => {
            onApply(rollingFromISO(today), today);
            setOpen(false);
          }}
        >
          Last 60 days
        </button>
        <button
          type="button"
          className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2"
          onClick={() => {
            onApply(addIstCalendarDays(today, -29), today);
            setOpen(false);
          }}
        >
          Last 30 days
        </button>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <label className="text-xs text-muted">
            From
            <input
              type="date"
              className="mt-1 w-full rounded border border-subtle px-2 py-1 text-sm"
              defaultValue={from}
              onBlur={(e) => {
                const nextFrom = e.target.value;
                if (nextFrom && to) onApply(nextFrom, to);
              }}
            />
          </label>
          <label className="text-xs text-muted">
            To
            <input
              type="date"
              className="mt-1 w-full rounded border border-subtle px-2 py-1 text-sm"
              defaultValue={to}
              onBlur={(e) => {
                const nextTo = e.target.value;
                if (from && nextTo) onApply(from, nextTo);
              }}
            />
          </label>
        </div>
      </div>
    </ActionPopover>
  );
}
