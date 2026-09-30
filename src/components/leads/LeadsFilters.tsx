"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_STATUSES } from "@/lib/leads/actionStatus";
import { LEAD_STAGES } from "@/lib/leads/computeStage";
import {
  clearedLeadsFilterState,
  leadsFilterChips,
  leadsHref,
  type LeadsFilterState
} from "@/lib/leads/listFilterParams";
import { stageLabel } from "@/components/leads/StageBadge";
import CheckboxMultiSelect from "@/components/ui/CheckboxMultiSelect";

const LIFECYCLE_TABS: Array<{ id: string; label: string }> = [
  { id: "active", label: "Active" },
  { id: "unqualified", label: "Unqualified" },
  { id: "dead", label: "Dead" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" }
];

const STAGE_OPTIONS = LEAD_STAGES.map((s) => ({ value: s, label: stageLabel(s) }));
const ACTION_STATUS_OPTIONS = ACTION_STATUSES.map((s) => ({ value: s, label: s }));

/** Filter panel + chips — both render the same (optimistic) state. */
export default function LeadsFilters({
  sources,
  state: serverState,
  deepLinkLabel
}: {
  sources: string[];
  state: LeadsFilterState;
  deepLinkLabel?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(serverState);
  const serverKey = leadsHref(serverState);

  useEffect(() => {
    setState(serverState);
    // serverKey captures every field of serverState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  function apply(next: LeadsFilterState) {
    setState(next);
    router.push(leadsHref(next));
  }

  function patch(p: Partial<LeadsFilterState>) {
    apply({ ...state, ...p });
  }

  const sourceOptions = Array.from(new Set([...sources, ...state.sources])).map((s) => ({
    value: s,
    label: s
  }));
  const chips = leadsFilterChips(state, {
    stage: stageLabel,
    deepLink: () => deepLinkLabel ?? ""
  });
  const deepLink = Boolean(state.cohort || state.event);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {LIFECYCLE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`rounded border px-3 py-1.5 text-sm ${
              state.lifecycle === tab.id
                ? "ui-active"
                : "border-slate-200 text-slate-700"
            }`}
            onClick={() => patch({ lifecycle: tab.id })}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          className={`rounded border px-3 py-1.5 text-sm ${
            state.lifecycle === "follow_ups_due"
              ? "border-red-700 bg-red-700 text-white"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
          onClick={() => patch({ lifecycle: "follow_ups_due" })}
        >
          Follow-ups Due
        </button>
        <button
          type="button"
          className={`rounded border px-3 py-1.5 text-sm ${
            state.lifecycle === "needs_verification"
              ? "ui-active"
              : "border-slate-200 text-slate-700"
          }`}
          onClick={() => patch({ lifecycle: "needs_verification" })}
        >
          Needs Verification Call
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-[220px] flex-1 flex-col text-xs text-slate-600">
          Search name or email
          <input
            key={serverState.q}
            defaultValue={state.q}
            className="mt-1 rounded border border-slate-200 px-3 py-2 text-sm text-slate-900"
            placeholder="Search"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const q = (e.target as HTMLInputElement).value.trim();
                if (q !== state.q) patch({ q });
              }
            }}
            onBlur={(e) => {
              const q = e.target.value.trim();
              if (q !== state.q) patch({ q });
            }}
          />
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
          selected={deepLink ? [] : state.stages}
          // Stage and cohort/event deep links are mutually exclusive.
          onChange={(next) => patch({ stages: next, cohort: undefined, event: undefined })}
        />

        <CheckboxMultiSelect
          label="Action status"
          options={ACTION_STATUS_OPTIONS}
          selected={state.actionStatuses}
          onChange={(next) => patch({ actionStatuses: next })}
        />

        <label className="flex flex-col text-xs text-slate-600">
          Dead?
          <select
            className="mt-1 min-w-[120px] rounded border border-slate-200 px-2 py-2 text-sm"
            value={state.isDead}
            onChange={(e) =>
              patch({ isDead: e.target.value as LeadsFilterState["isDead"] })
            }
          >
            <option value="">All</option>
            <option value="true">Dead only</option>
            <option value="false">Not dead</option>
          </select>
        </label>
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
                onClick={() => apply(chip.without)}
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
