"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FOLLOW_UP_LABELS,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type FollowUpState
} from "@/lib/leads/lifecycleDefinitions";
import CustomFilterBuilder from "@/components/leads/CustomFilterBuilder";
import CheckboxMultiSelect from "@/components/ui/CheckboxMultiSelect";
import {
  ChipTextLink,
  FilterChip,
  FilterSearchInput,
  ToolbarDivider
} from "@/components/leads/FilterToolbar";
import SavedFilterMenu from "@/components/leads/SavedFilterMenu";
import { ToolbarTrailingSlot } from "@/components/leads/ToolbarPortal";
import { useFilterPending } from "@/components/leads/FilterPending";
import { useFilterSearch } from "@/components/leads/useFilterSearch";
import type { FilterEnumValueMap } from "@/lib/db/filterEnumValues";
import {
  completeCustomFilter,
  customConditionChipParts,
  customFilterYields,
  isCustomFilterEmpty,
  yieldNote,
  type CustomFilter
} from "@/lib/leads/customFilter";
import type { NamedLeadFilter } from "@/lib/leads/namedFilters";
import {
  DEAD_FILTER_LABELS,
  buildLeadsQuery,
  clearedLeadsFilterState,
  leadsFilterChips,
  leadsHref,
  type LeadsFilterState
} from "@/lib/leads/listFilterParams";
import type { DeadFilter, PipelineStage } from "@/lib/leads/types";

const STAGE_OPTIONS = PIPELINE_STAGES.map((s) => ({ value: s, label: PIPELINE_STAGE_LABELS[s] }));
const FOLLOW_UP_OPTIONS = (Object.keys(FOLLOW_UP_LABELS) as FollowUpState[]).map((s) => ({
  value: s,
  label: FOLLOW_UP_LABELS[s]
}));

function YesNoSelect({
  label,
  value,
  onChange
}: {
  label: string;
  value: "" | "yes" | "no";
  onChange: (next: "" | "yes" | "no") => void;
}) {
  return (
    <label className="flex flex-col text-xs text-muted">
      {label}
      <select
        className="mt-1 h-8 min-w-[110px] rounded-sm border border-subtle px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as "" | "yes" | "no")}
      >
        <option value="">Any</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );
}

/** Filter toolbar + chips. Search `q` always follows the URL; other filters stay optimistic. */
export default function LeadsFilters({
  sources,
  state: serverState,
  customKeys = [],
  enumValues = {},
  namedFilters = [],
  canManageShared = false
}: {
  sources: string[];
  state: LeadsFilterState;
  customKeys?: string[];
  enumValues?: FilterEnumValueMap;
  namedFilters?: NamedLeadFilter[];
  canManageShared?: boolean;
}) {
  const router = useRouter();
  const { pending, start } = useFilterPending();
  const [state, setState] = useState(serverState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const serverKey = leadsHref(serverState);
  const urlQ = serverState.q;
  const [filterOpen, setFilterOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [seedBlank, setSeedBlank] = useState(false);
  const [addNonce, setAddNonce] = useState(0);
  const [saveRequestKey, setSaveRequestKey] = useState(0);

  useEffect(() => {
    setState(serverState);
    // serverKey captures every field of serverState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const search = useFilterSearch({
    urlValue: urlQ,
    onCommit: (q, { isLatest, immediate }) => {
      start(() => {
        if (!isLatest()) return;
        const href = leadsHref({ ...stateRef.current, q });
        if (immediate) router.push(href);
        else router.replace(href);
      });
    }
  });

  function apply(next: LeadsFilterState, mode: "push" | "replace" = "push") {
    setState(next);
    start(() => {
      if (mode === "replace") router.replace(leadsHref(next));
      else router.push(leadsHref(next));
    });
  }

  function patch(p: Partial<LeadsFilterState>) {
    apply({ ...state, q: urlQ, ...p });
  }

  const mergedEnums: FilterEnumValueMap = {
    ...enumValues,
    lead_source: Array.from(new Set([...(enumValues.lead_source ?? []), ...sources]))
  };

  const sourceOptions = Array.from(new Set([...sources, ...state.sources])).map((s) => ({
    value: s,
    label: s
  }));
  const chips = leadsFilterChips({ ...state, q: urlQ }).filter((c) => c.id !== "q");
  const customConditions = state.customFilter?.conditions ?? [];
  const match = state.customFilter?.match === "any" ? "any" : "all";
  const note = yieldNote(customFilterYields(state.customFilter));
  const activeCount = chips.length;

  function openFilter(opts: { add?: boolean; focusId?: string | null } = {}) {
    setFocusId(opts.focusId ?? null);
    if (opts.add && filterOpen) {
      setAddNonce((n) => n + 1);
      return;
    }
    setSeedBlank(Boolean(opts.add) || isCustomFilterEmpty(state.customFilter));
    setFilterOpen(true);
  }

  function applyCustom(next: CustomFilter | null) {
    patch({ customFilter: completeCustomFilter(next) });
  }

  return (
    <div className="space-y-2" data-testid="leads-filters">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSearchInput
          testId="leads-search"
          labelledBy="leads-search-label"
          label="Search leads"
          placeholder="Search name, email, or phone"
          value={search.draft}
          onChange={search.onChange}
          onEnter={search.onEnter}
          pending={pending}
        />
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1 max-md:w-full">
          <CustomFilterBuilder
            filter={state.customFilter}
            customKeys={customKeys}
            enumValues={mergedEnums}
            onApply={applyCustom}
            open={filterOpen}
            onOpenChange={(next) => {
              if (next) openFilter({ add: isCustomFilterEmpty(state.customFilter) });
              else setFilterOpen(false);
            }}
            focusConditionId={focusId}
            seedBlank={seedBlank}
            addNonce={addNonce}
            activeCount={activeCount}
          >
            <div className="mb-3 flex flex-wrap items-end gap-3 border-b border-subtle pb-3">
              <CheckboxMultiSelect
                label="Source"
                options={sourceOptions}
                selected={state.sources}
                onChange={(next) => patch({ sources: next })}
              />
              <CheckboxMultiSelect
                label="Stage"
                options={STAGE_OPTIONS}
                selected={state.stages}
                onChange={(next) => patch({ stages: next as PipelineStage[] })}
              />
              <label className="flex flex-col text-xs text-muted">
                Dead
                <select
                  className="mt-1 h-8 min-w-[120px] rounded-sm border border-subtle px-2 text-sm"
                  value={state.dead}
                  onChange={(e) => patch({ dead: e.target.value as DeadFilter })}
                >
                  {(Object.keys(DEAD_FILTER_LABELS) as DeadFilter[]).map((d) => (
                    <option key={d} value={d}>
                      {DEAD_FILTER_LABELS[d]}
                    </option>
                  ))}
                </select>
              </label>
              <YesNoSelect
                label="Form Qualified"
                value={state.formQualified}
                onChange={(formQualified) => patch({ formQualified })}
              />
              <YesNoSelect
                label="Qualified"
                value={state.qualified}
                onChange={(qualified) => patch({ qualified })}
              />
              <CheckboxMultiSelect
                label="Follow-up"
                options={FOLLOW_UP_OPTIONS}
                selected={state.followUp}
                onChange={(next) => patch({ followUp: next as FollowUpState[] })}
              />
              <button
                type="button"
                aria-pressed={state.needsQualification}
                className={`h-8 rounded-sm border px-3 text-sm ${
                  state.needsQualification ? "ui-active" : "border-subtle text-fg"
                }`}
                onClick={() => patch({ needsQualification: !state.needsQualification })}
              >
                Needs qualification
              </button>
            </div>
          </CustomFilterBuilder>
          <SavedFilterMenu
            pageKey="leads"
            items={namedFilters}
            canManageShared={canManageShared}
            currentQuery={buildLeadsQuery({ ...state, q: urlQ })}
            saveRequestKey={saveRequestKey}
          />
          <ToolbarDivider />
          <ToolbarTrailingSlot />
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {customConditions.length >= 2 ? (
            <button
              type="button"
              data-testid="cf-match-prefix"
              className="text-xs text-muted hover:text-fg"
              onClick={() =>
                patch({
                  customFilter: state.customFilter
                    ? { ...state.customFilter, match: match === "all" ? "any" : "all" }
                    : null
                })
              }
            >
              Where {match} of:
            </button>
          ) : null}
          {chips.map((chip) => {
            const cf = chip.id.startsWith("cf:") ? chip.id.slice(3) : null;
            const condition = cf
              ? customConditions.find((c) => c.id === cf)
              : undefined;
            const parts = condition
              ? customConditionChipParts(condition)
              : splitChipLabel(chip.label);
            return (
              <FilterChip
                key={chip.id}
                testId={`filter-chip-${chip.id}`}
                field={parts.field}
                rest={parts.rest}
                removeLabel={`Remove ${chip.label}`}
                onEdit={() => openFilter({ focusId: condition?.id ?? null })}
                onRemove={() => apply({ ...chip.without, q: urlQ })}
              />
            );
          })}
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
          <ChipTextLink onClick={() => apply(clearedLeadsFilterState(state))}>
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

function splitChipLabel(label: string): { field: string; rest: string } {
  const idx = label.indexOf(":");
  if (idx === -1) return { field: label, rest: "" };
  return { field: label.slice(0, idx).trim(), rest: label.slice(idx + 1).trim() };
}
