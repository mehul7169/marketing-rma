"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FOLLOW_UP_LABELS,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type FollowUpState
} from "@/lib/leads/lifecycleDefinitions";
import {
  DEAD_FILTER_LABELS,
  clearedLeadsFilterState,
  leadsFilterChips,
  leadsHref,
  type LeadsFilterState
} from "@/lib/leads/listFilterParams";
import type { DeadFilter, PipelineStage } from "@/lib/leads/types";
import CheckboxMultiSelect from "@/components/ui/CheckboxMultiSelect";
import Spinner from "@/components/ui/Spinner";
import { useFilterPending } from "@/components/leads/FilterPending";
import { useFilterSearch } from "@/components/leads/useFilterSearch";

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
    <label className="flex flex-col text-xs text-slate-600">
      {label}
      <select
        className="mt-1 min-w-[110px] rounded border border-slate-200 px-2 py-2 text-sm"
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

/** Filter panel + chips. Search `q` always follows the URL; other filters stay optimistic. */
export default function LeadsFilters({
  sources,
  state: serverState
}: {
  sources: string[];
  state: LeadsFilterState;
}) {
  const router = useRouter();
  const { pending, start } = useFilterPending();
  const [state, setState] = useState(serverState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const serverKey = leadsHref(serverState);
  const urlQ = serverState.q;

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

  const sourceOptions = Array.from(new Set([...sources, ...state.sources])).map((s) => ({
    value: s,
    label: s
  }));
  const chips = leadsFilterChips({ ...state, q: urlQ });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="relative flex min-w-[220px] flex-1 flex-col text-xs text-slate-600">
          Search name or email
          <input
            data-testid="leads-search"
            value={search.draft}
            onChange={(e) => search.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search.onEnter();
              }
            }}
            className="mt-1 rounded border border-slate-200 px-3 py-2 pr-8 text-sm text-slate-900"
            placeholder="Search"
            autoComplete="off"
          />
          {pending ? (
            <span
              className="pointer-events-none absolute right-2 top-[1.85rem]"
              data-testid="search-pending"
            >
              <Spinner size="xs" label="Searching" />
            </span>
          ) : null}
        </label>

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

        <label className="flex flex-col text-xs text-slate-600">
          Dead
          <select
            className="mt-1 min-w-[120px] rounded border border-slate-200 px-2 py-2 text-sm"
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
          className={`rounded border px-3 py-2 text-sm ${
            state.needsQualification ? "ui-active" : "border-slate-200 text-slate-700"
          }`}
          onClick={() => patch({ needsQualification: !state.needsQualification })}
        >
          Needs qualification
        </button>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <span
              key={chip.id}
              data-testid={`filter-chip-${chip.id}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-3 pr-1 text-xs text-slate-800"
            >
              <span className="truncate">{chip.label}</span>
              <button
                type="button"
                aria-label={`Remove ${chip.label}`}
                className="rounded-full px-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                onClick={() => apply({ ...chip.without, q: chip.id === "q" ? "" : urlQ })}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            className="text-xs text-slate-500 underline decoration-slate-300 hover:text-slate-900"
            onClick={() => apply(clearedLeadsFilterState(state))}
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}
