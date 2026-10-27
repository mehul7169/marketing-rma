/**
 * /leads filter state <-> URL params. Single source for the filter panel,
 * chips, pagination and persistence so they can't drift apart.
 * Vocabulary comes from lifecycleDefinitions.
 */

import {
  FOLLOW_UP_LABELS,
  KPI_DEFINITIONS,
  PIPELINE_STAGE_LABELS,
  isKpiKey,
  isPipelineStage,
  type FollowUpState,
  type KpiKey
} from "@/lib/leads/lifecycleDefinitions";
import type {
  DeadFilter,
  LeadListFilters,
  PipelineStage,
  YesNoFilter
} from "@/lib/leads/types";
import { clampDateRange, defaultFromISO } from "@/lib/utils/date";

export type LeadsFilterState = {
  fromISO: string;
  toISO: string;
  /** Rolling "last N days" — omitted from the URL so it stays rolling. */
  isDefaultRange: boolean;
  /** Milestone deep link: the date range applies to this KPI's timestamp. */
  kpi?: KpiKey;
  stages: PipelineStage[];
  dead: DeadFilter;
  formQualified: "" | YesNoFilter;
  qualified: "" | YesNoFilter;
  needsQualification: boolean;
  followUp: FollowUpState[];
  sources: string[];
  q: string;
};

export type LeadsSearchParams = Record<string, string | string[] | undefined>;

export const DEAD_FILTER_LABELS: Record<DeadFilter, string> = {
  hide: "Hide dead",
  show: "Show dead",
  only: "Dead only"
};

const FOLLOW_UP_STATES: FollowUpState[] = ["overdue", "today", "upcoming"];

/** URL keys written before the Stage/overlay vocabulary (saved views, old links). */
export const LEGACY_LEADS_PARAM_KEYS = [
  "lifecycle",
  "action_status",
  "is_dead",
  "cohort",
  "event"
] as const;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Accepts comma-separated and/or repeated params (`?source=a,b` or `?source=a&source=b`). */
export function parseList(v: string | string[] | undefined): string[] {
  const parts = (Array.isArray(v) ? v : v ? [v] : []).flatMap((s) => s.split(","));
  return Array.from(new Set(parts.map((s) => s.trim()).filter(Boolean)));
}

function yesNo(v: string | undefined): "" | YesNoFilter {
  return v === "yes" || v === "no" ? v : "";
}

export function hasLegacyLeadsParams(params: LeadsSearchParams): boolean {
  if (LEGACY_LEADS_PARAM_KEYS.some((k) => first(params[k]) !== undefined)) return true;
  return parseList(params.stage).some((s) => !isPipelineStage(s));
}

type LegacyOverrides = Partial<
  Pick<LeadsFilterState, "kpi" | "dead" | "qualified" | "needsQualification">
> & { stages: PipelineStage[]; followUp: FollowUpState[] };

const LEGACY_STAGE_MAP: Record<string, PipelineStage | "dead"> = {
  created: "new",
  call_booked: "call_booked",
  qualified_call_booked: "call_booked",
  show_up: "showed_up",
  follow_up_call_booked: "showed_up",
  awaiting_lead_response: "showed_up",
  proposal_needed: "showed_up",
  contract_shared: "showed_up",
  awaiting_payment: "showed_up",
  closed: "showed_up",
  dead: "dead"
};

const LEGACY_ACTION_STATUS_MAP: Record<
  string,
  { stage?: PipelineStage; followUp?: FollowUpState; dead?: true }
> = {
  Untouched: { stage: "new" },
  "Personally Contacted": { stage: "contacted" },
  "Call Booked": { stage: "call_booked" },
  "Qualified Call Booked": { stage: "call_booked" },
  "Follow-up Due": { followUp: "today" },
  "Follow-up Overdue": { followUp: "overdue" },
  Closed: { stage: "showed_up" },
  Dead: { dead: true }
};

const LEGACY_EVENT_MAP: Record<string, { kpi?: KpiKey; qualified?: YesNoFilter }> = {
  created: {},
  lead: {},
  call_booked: { kpi: "calls_booked" },
  booked: { kpi: "calls_booked" },
  qualified_call_booked: { kpi: "calls_booked", qualified: "yes" },
  show_up: { kpi: "showups" },
  showed: { kpi: "showups" },
  closed: { kpi: "deals_closed" }
};

/** Best-effort mapping of retired params onto the new filter keys. */
function legacyOverrides(params: LeadsSearchParams): LegacyOverrides {
  const out: LegacyOverrides = { stages: [], followUp: [] };
  const lifecycle = first(params.lifecycle)?.trim();
  if (lifecycle === "active") out.dead = "hide";
  if (lifecycle === "dead") out.dead = "only";
  if (lifecycle === "unqualified") out.qualified = "no";
  if (lifecycle === "closed" || lifecycle === "all") out.dead = "show";
  if (lifecycle === "follow_ups_due") out.followUp.push("overdue", "today");
  if (lifecycle === "needs_verification") out.needsQualification = true;

  const isDead = first(params.is_dead)?.trim();
  if (isDead === "true") out.dead = "only";
  if (isDead === "false") out.dead = "hide";

  for (const s of parseList(params.stage)) {
    if (isPipelineStage(s)) continue;
    const mapped = LEGACY_STAGE_MAP[s];
    if (mapped === "dead") out.dead = "only";
    else if (mapped) out.stages.push(mapped);
  }
  for (const s of parseList(params.action_status)) {
    const mapped = LEGACY_ACTION_STATUS_MAP[s];
    if (mapped?.stage) out.stages.push(mapped.stage);
    if (mapped?.followUp) out.followUp.push(mapped.followUp);
    if (mapped?.dead) out.dead = "only";
  }

  const event = first(params.cohort)?.trim() || first(params.event)?.trim();
  if (event) {
    const mapped = LEGACY_EVENT_MAP[event] ?? {};
    if (mapped.kpi) out.kpi = mapped.kpi;
    if (mapped.qualified) out.qualified = mapped.qualified;
    // Old cohort/event links implied lifecycle=all.
    out.dead ??= "show";
  }
  return out;
}

/** Rewrite a saved /leads URL (old or new keys) onto the current param set. */
export function migratePersistedLeadsParams(
  saved: Record<string, string>,
  todayISO: string
): Record<string, string> {
  return buildLeadsQuery(parseLeadsFilterParams(saved, todayISO));
}

export function parseLeadsFilterParams(
  params: LeadsSearchParams,
  todayISO: string
): LeadsFilterState {
  const defaultFrom = defaultFromISO(todayISO);
  let fromISO = defaultFrom;
  let toISO = todayISO;
  const rawFrom = first(params.from);
  const rawTo = first(params.to);
  if (rawFrom && rawTo) {
    try {
      ({ fromISO, toISO } = clampDateRange(rawFrom, rawTo));
    } catch {
      // default range
    }
  }

  const legacy = legacyOverrides(params);
  const rawKpi = first(params.kpi)?.trim();
  const kpi = isKpiKey(rawKpi) ? rawKpi : legacy.kpi;
  const rawDead = first(params.dead)?.trim();
  // Milestone links count dead leads too, so they show them by default.
  const dead: DeadFilter =
    rawDead === "hide" || rawDead === "show" || rawDead === "only"
      ? rawDead
      : (legacy.dead ?? (kpi ? "show" : "hide"));
  const stages = Array.from(
    new Set([...parseList(params.stage).filter(isPipelineStage), ...legacy.stages])
  );
  const followUp = FOLLOW_UP_STATES.filter(
    (s) => parseList(params.follow_up).includes(s) || legacy.followUp.includes(s)
  );

  return {
    fromISO,
    toISO,
    isDefaultRange: fromISO === defaultFrom && toISO === todayISO,
    kpi,
    stages,
    dead,
    formQualified: yesNo(first(params.form_qualified)?.trim()),
    qualified: yesNo(first(params.qualified)?.trim()) || (legacy.qualified ?? ""),
    needsQualification:
      first(params.needs_qualification) === "1" || Boolean(legacy.needsQualification),
    followUp,
    sources: parseList(params.source),
    q: first(params.q)?.trim() ?? ""
  };
}

/** dead is always written so the URL counts as explicit (no restore redirect). */
export function buildLeadsQuery(state: LeadsFilterState): Record<string, string> {
  const q: Record<string, string> = {};
  if (!state.isDefaultRange) {
    q.from = state.fromISO;
    q.to = state.toISO;
  }
  if (state.kpi) q.kpi = state.kpi;
  q.dead = state.dead;
  if (state.stages.length) q.stage = state.stages.join(",");
  if (state.formQualified) q.form_qualified = state.formQualified;
  if (state.qualified) q.qualified = state.qualified;
  if (state.needsQualification) q.needs_qualification = "1";
  if (state.followUp.length) q.follow_up = state.followUp.join(",");
  if (state.sources.length) q.source = state.sources.join(",");
  if (state.q) q.q = state.q;
  return q;
}

export function leadsHref(state: LeadsFilterState): string {
  return `/leads?${new URLSearchParams(buildLeadsQuery(state)).toString()}`;
}

/** listLeads/countLeads filters for this state (same for rows and total). */
export function leadListFiltersFromState(
  orgId: string,
  state: LeadsFilterState
): LeadListFilters {
  return {
    orgId,
    fromISO: state.fromISO,
    toISO: state.toISO,
    kpi: state.kpi,
    pipelineStages: state.stages.length ? state.stages : undefined,
    dead: state.dead,
    formQualified: state.formQualified || undefined,
    qualified: state.qualified || undefined,
    needsQualification: state.needsQualification || undefined,
    followUp: state.followUp.length ? state.followUp : undefined,
    sources: state.sources.length ? state.sources : undefined,
    search: state.q || undefined
  };
}

/** Deep link for a KPI count (Home funnel, Meta Ads, Slack). */
export function kpiLeadsHref(
  kpi: KpiKey,
  range: { fromISO: string; toISO: string },
  extra: { sources?: string[] } = {}
): string {
  const params = new URLSearchParams({
    from: range.fromISO,
    to: range.toISO,
    dead: "show"
  });
  if (kpi !== "leads") params.set("kpi", kpi);
  if (extra.sources?.length) params.set("source", extra.sources.join(","));
  return `/leads?${params.toString()}`;
}

export function clearedLeadsFilterState(state: LeadsFilterState): LeadsFilterState {
  return {
    ...state,
    isDefaultRange: true,
    kpi: undefined,
    stages: [],
    dead: "hide",
    formQualified: "",
    qualified: "",
    needsQualification: false,
    followUp: [],
    sources: [],
    q: ""
  };
}

export type LeadsFilterChip = {
  id: string;
  label: string;
  /** State after removing this chip. */
  without: LeadsFilterState;
};

export function leadsFilterChips(state: LeadsFilterState): LeadsFilterChip[] {
  const chips: LeadsFilterChip[] = [];
  if (state.kpi) {
    chips.push({
      id: "kpi",
      label: KPI_DEFINITIONS[state.kpi].label,
      without: { ...state, kpi: undefined, dead: "hide" }
    });
  }
  if (!state.isDefaultRange) {
    chips.push({
      id: "date",
      label: `Date: ${state.fromISO} – ${state.toISO}`,
      without: { ...state, isDefaultRange: true }
    });
  }
  // KPI links default to showing dead; only call out a non-default choice.
  const defaultDead: DeadFilter = state.kpi ? "show" : "hide";
  if (state.dead !== defaultDead) {
    chips.push({
      id: "dead",
      label: DEAD_FILTER_LABELS[state.dead],
      without: { ...state, dead: defaultDead }
    });
  }
  if (state.stages.length) {
    chips.push({
      id: "stage",
      label: `Stage: ${state.stages.map((s) => PIPELINE_STAGE_LABELS[s]).join(", ")}`,
      without: { ...state, stages: [] }
    });
  }
  if (state.qualified) {
    chips.push({
      id: "qualified",
      label: `Qualified: ${state.qualified === "yes" ? "Yes" : "No"}`,
      without: { ...state, qualified: "" }
    });
  }
  if (state.formQualified) {
    chips.push({
      id: "form_qualified",
      label: `Form Qualified: ${state.formQualified === "yes" ? "Yes" : "No"}`,
      without: { ...state, formQualified: "" }
    });
  }
  if (state.needsQualification) {
    chips.push({
      id: "needs_qualification",
      label: "Needs qualification",
      without: { ...state, needsQualification: false }
    });
  }
  if (state.followUp.length) {
    chips.push({
      id: "follow_up",
      label: `Follow-up: ${state.followUp.map((s) => FOLLOW_UP_LABELS[s]).join(", ")}`,
      without: { ...state, followUp: [] }
    });
  }
  if (state.sources.length) {
    chips.push({
      id: "source",
      label: `Source: ${state.sources.join(", ")}`,
      without: { ...state, sources: [] }
    });
  }
  if (state.q) {
    chips.push({
      id: "q",
      label: `Search: ${state.q}`,
      without: { ...state, q: "" }
    });
  }
  return chips;
}
