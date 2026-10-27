/**
 * Auto-remembered "last used" filter state per user + page, stored in
 * table_views.config.filters[orgId] as the page's own URL params.
 */

import { migratePersistedLeadsParams } from "@/lib/leads/listFilterParams";
import { todayISTDateString } from "@/lib/timezone";
import { defaultFromISO } from "@/lib/utils/date";

const QUEUE_FILTER_ALIASES: Record<string, string> = {
  untouched: "new",
  personally_contacted: "contacted"
};

/** URL param → value, exactly as it appears in the page URL. */
export type PersistedFilterState = Record<string, string>;

/** Params that are remembered and restored per page. */
const PERSISTED_KEYS: Record<string, readonly string[]> = {
  leads: [
    "from",
    "to",
    "stage",
    "dead",
    "form_qualified",
    "qualified",
    "needs_qualification",
    "follow_up",
    "source",
    "q",
    // Retired keys: still read so old saved state restores (then migrates).
    "lifecycle",
    "action_status",
    "is_dead"
  ],
  "leads-queue": ["view", "tab", "filter", "search", "show_unqualified"]
};

/** Deep-link params: explicit (block restore) but never remembered. */
const DEEP_LINK_KEYS: Record<string, readonly string[]> = {
  leads: ["kpi", "cohort", "event", "lead"],
  "leads-queue": ["lead"]
};

const MAX_VALUE_LENGTH = 500;

type ParamsLike = Record<string, string | string[] | undefined> | URLSearchParams;

function readParam(params: ParamsLike, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

export function hasPersistedFilterKeys(pageKey: string): boolean {
  return pageKey in PERSISTED_KEYS;
}

/** True when the URL already carries filter intent (shared/cohort link or in-app nav). */
export function hasExplicitFilterParams(pageKey: string, params: ParamsLike): boolean {
  const keys = [...(PERSISTED_KEYS[pageKey] ?? []), ...(DEEP_LINK_KEYS[pageKey] ?? [])];
  return keys.some((k) => readParam(params, k) !== undefined);
}

/**
 * The subset of params to remember, or null when this URL shouldn't overwrite
 * the saved state (deep links). A rolling default date range is dropped so it
 * stays "last N days" instead of freezing to today's dates.
 */
export function pickPersistableFilters(
  pageKey: string,
  params: ParamsLike,
  todayISO: string
): PersistedFilterState | null {
  const keys = PERSISTED_KEYS[pageKey];
  if (!keys) return null;
  if ((DEEP_LINK_KEYS[pageKey] ?? []).some((k) => readParam(params, k) !== undefined)) {
    return null;
  }
  const out: PersistedFilterState = {};
  for (const key of keys) {
    const value = readParam(params, key)?.trim();
    if (value) out[key] = value.slice(0, MAX_VALUE_LENGTH);
  }
  if (out.from === defaultFromISO(todayISO) && out.to === todayISO) {
    delete out.from;
    delete out.to;
  }
  return migratePersistedState(pageKey, out, todayISO);
}

export function parsePersistedFilterState(
  pageKey: string,
  raw: unknown
): PersistedFilterState | null {
  const keys = PERSISTED_KEYS[pageKey];
  if (!keys || !raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: PersistedFilterState = {};
  for (const key of keys) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, MAX_VALUE_LENGTH);
  }
  return out;
}

/** Map retired URL keys onto the current vocabulary so saved views still load. */
export function migratePersistedState(
  pageKey: string,
  state: PersistedFilterState,
  todayISO: string = todayISTDateString()
): PersistedFilterState {
  if (pageKey === "leads") return migratePersistedLeadsParams(state, todayISO);
  if (pageKey === "leads-queue" && state.filter && QUEUE_FILTER_ALIASES[state.filter]) {
    return { ...state, filter: QUEUE_FILTER_ALIASES[state.filter] };
  }
  return state;
}

/** Redirect target when restoring; null when nothing is saved. */
export function restoreHref(pathname: string, state: PersistedFilterState | null): string | null {
  if (!state || Object.keys(state).length === 0) return null;
  const pageKey = pathname === "/leads/queue" ? "leads-queue" : pathname === "/leads" ? "leads" : "";
  const migrated = pageKey ? migratePersistedState(pageKey, state) : state;
  if (Object.keys(migrated).length === 0) return null;
  return `${pathname}?${new URLSearchParams(migrated).toString()}`;
}
