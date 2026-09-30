/**
 * /leads filter state <-> URL params. Single source for the filter panel,
 * chips, pagination and persistence so they can't drift apart.
 */

import { clampDateRange, defaultFromISO } from "@/lib/utils/date";

export type LeadsFilterState = {
  fromISO: string;
  toISO: string;
  /** Rolling "last N days" — omitted from the URL so it stays rolling. */
  isDefaultRange: boolean;
  lifecycle: string;
  stages: string[];
  sources: string[];
  actionStatuses: string[];
  isDead: "" | "true" | "false";
  q: string;
  cohort?: string;
  event?: string;
};

export type LeadsSearchParams = Record<string, string | string[] | undefined>;

export const LIFECYCLE_LABELS: Record<string, string> = {
  active: "Active",
  unqualified: "Unqualified",
  dead: "Dead",
  closed: "Closed",
  all: "All",
  follow_ups_due: "Follow-ups Due",
  needs_verification: "Needs Verification Call"
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Accepts comma-separated and/or repeated params (`?source=a,b` or `?source=a&source=b`). */
export function parseList(v: string | string[] | undefined): string[] {
  const parts = (Array.isArray(v) ? v : v ? [v] : []).flatMap((s) => s.split(","));
  return Array.from(new Set(parts.map((s) => s.trim()).filter(Boolean)));
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
  const cohort = first(params.cohort)?.trim() || undefined;
  const event = first(params.event)?.trim() || undefined;
  const dead = first(params.is_dead)?.trim();
  return {
    fromISO,
    toISO,
    isDefaultRange: fromISO === defaultFrom && toISO === todayISO,
    lifecycle:
      first(params.lifecycle)?.trim() || (cohort || event ? "all" : "active"),
    stages: parseList(params.stage),
    sources: parseList(params.source),
    actionStatuses: parseList(params.action_status),
    isDead: dead === "true" || dead === "false" ? dead : "",
    q: first(params.q)?.trim() ?? "",
    cohort,
    event
  };
}

/** lifecycle is always written so the URL counts as explicit (no restore redirect). */
export function buildLeadsQuery(state: LeadsFilterState): Record<string, string> {
  const q: Record<string, string> = {};
  if (!state.isDefaultRange) {
    q.from = state.fromISO;
    q.to = state.toISO;
  }
  q.lifecycle = state.lifecycle || "active";
  if (state.stages.length) q.stage = state.stages.join(",");
  if (state.sources.length) q.source = state.sources.join(",");
  if (state.actionStatuses.length) q.action_status = state.actionStatuses.join(",");
  if (state.isDead) q.is_dead = state.isDead;
  if (state.q) q.q = state.q;
  if (state.cohort) q.cohort = state.cohort;
  if (state.event) q.event = state.event;
  return q;
}

export function leadsHref(state: LeadsFilterState): string {
  return `/leads?${new URLSearchParams(buildLeadsQuery(state)).toString()}`;
}

export function clearedLeadsFilterState(state: LeadsFilterState): LeadsFilterState {
  return {
    ...state,
    isDefaultRange: true,
    lifecycle: "active",
    stages: [],
    sources: [],
    actionStatuses: [],
    isDead: "",
    q: "",
    cohort: undefined,
    event: undefined
  };
}

export type LeadsFilterChip = {
  id: string;
  label: string;
  /** State after removing this chip. */
  without: LeadsFilterState;
};

export function leadsFilterChips(
  state: LeadsFilterState,
  labels: { stage: (s: string) => string; deepLink?: (v: string) => string }
): LeadsFilterChip[] {
  const chips: LeadsFilterChip[] = [];
  const deepLink = Boolean(state.cohort || state.event);
  const deepLinkLabel = labels.deepLink ?? ((v: string) => v);
  if (state.cohort) {
    chips.push({
      id: "cohort",
      label: `Cohort: ${deepLinkLabel(state.cohort)}`,
      without: { ...state, cohort: undefined, lifecycle: "active" }
    });
  }
  if (state.event) {
    chips.push({
      id: "event",
      label: `Event: ${deepLinkLabel(state.event)}`,
      without: { ...state, event: undefined, lifecycle: "active" }
    });
  }
  if (!state.isDefaultRange) {
    chips.push({
      id: "date",
      label: `Date: ${state.fromISO} – ${state.toISO}`,
      without: { ...state, isDefaultRange: true }
    });
  }
  if (state.lifecycle !== "active" && !(deepLink && state.lifecycle === "all")) {
    chips.push({
      id: "lifecycle",
      label: `Lifecycle: ${LIFECYCLE_LABELS[state.lifecycle] ?? state.lifecycle}`,
      without: { ...state, lifecycle: "active" }
    });
  }
  if (state.sources.length) {
    chips.push({
      id: "source",
      label: `Source: ${state.sources.join(", ")}`,
      without: { ...state, sources: [] }
    });
  }
  // Stage is ignored while a cohort/event deep link is active.
  if (state.stages.length && !deepLink) {
    chips.push({
      id: "stage",
      label: `Stage: ${state.stages.map(labels.stage).join(", ")}`,
      without: { ...state, stages: [] }
    });
  }
  if (state.actionStatuses.length) {
    chips.push({
      id: "action_status",
      label: `Action status: ${state.actionStatuses.join(", ")}`,
      without: { ...state, actionStatuses: [] }
    });
  }
  if (state.isDead) {
    chips.push({
      id: "is_dead",
      label: `Dead: ${state.isDead === "true" ? "Dead only" : "Not dead"}`,
      without: { ...state, isDead: "" }
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
