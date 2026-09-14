import type { LeadRow } from "@/lib/leads/types";
import { toISTDateString } from "@/lib/timezone";

/**
 * Funnel stage keys shared by Overview cards and /leads deep links.
 * Cohort counting: created_at in range, then "ever reached" via raw fields.
 */
export const FUNNEL_STAGE_EVENT_FIELD = {
  created: "created_at",
  call_booked: "call_booked_at",
  qualified_call_booked: "call_booked_at",
  show_up: "call_showed_at",
  closed: "closed_at"
} as const;

export type FunnelEventStage = keyof typeof FUNNEL_STAGE_EVENT_FIELD;

/** URL `?cohort=` / legacy `?event=` values. */
export const URL_EVENT_KEYS = {
  created: "created",
  call_booked: "call_booked",
  qualified_call_booked: "qualified_call_booked",
  show_up: "show_up",
  closed: "closed",
  // Legacy aliases → new keys
  booked: "call_booked",
  showed: "show_up",
  lead: "created"
} as const;

export type UrlEventKey = keyof typeof URL_EVENT_KEYS;

export function isFunnelEventStage(stage: string): stage is FunnelEventStage {
  return stage in FUNNEL_STAGE_EVENT_FIELD;
}

export function parseUrlEvent(value: string | undefined): FunnelEventStage | null {
  if (!value) return null;
  const mapped = URL_EVENT_KEYS[value as UrlEventKey];
  if (mapped && isFunnelEventStage(mapped)) return mapped;
  if (isFunnelEventStage(value)) return value;
  return null;
}

export function urlCohortForFunnelStage(stage: FunnelEventStage): string | null {
  if (stage === "created") return null;
  return stage;
}

export function cohortBannerCopy(stage: FunnelEventStage): string {
  const phrases: Record<Exclude<FunnelEventStage, "created">, string> = {
    call_booked: "booked a call",
    qualified_call_booked: "reached Qualified Call Booked",
    show_up: "showed up",
    closed: "closed a deal"
  };
  if (stage === "created") {
    return "Showing the cohort of leads created in this range.";
  }
  return `Showing cohort leads (created in this range) who ${phrases[stage]}, including those who have since moved further.`;
}

export function eventBannerCopy(stage: FunnelEventStage): string {
  const phrases: Record<Exclude<FunnelEventStage, "created">, string> = {
    call_booked: "booked a call",
    qualified_call_booked: "reached Qualified Call Booked",
    show_up: "showed up",
    closed: "closed a deal"
  };
  if (stage === "created") {
    return "Showing leads created in this range.";
  }
  return `Showing leads who ${phrases[stage]} in this range, including those who have since moved further.`;
}

export function eventDateISO(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = toISTDateString(iso);
  return d || null;
}

export function eventInRange(
  iso: string | null | undefined,
  fromISO: string,
  toISO: string
): boolean {
  const d = eventDateISO(iso);
  if (!d) return false;
  return d >= fromISO && d <= toISO;
}

/**
 * Cohort member reached this funnel stage at any time.
 * Always count off persistent milestone fields — never current `stage`
 * (stage is a snapshot; later progress would undercount earlier steps).
 * Cohort membership itself is created_at in range — apply that separately.
 *
 * Fields: created → membership; call_booked → call_booked_at;
 * qualified_call_booked → call_confirmed; show_up → call_showed;
 * closed → deal_closed.
 */
export function leadReachedCohortStage(lead: LeadRow, stage: FunnelEventStage): boolean {
  switch (stage) {
    case "created":
      return true;
    case "call_booked":
      return Boolean(lead.call_booked_at);
    case "qualified_call_booked":
      // Persistent flag — never resets once true. Do not use stage=.
      return lead.call_confirmed === true;
    case "show_up":
      return lead.call_showed === true;
    case "closed":
      return lead.deal_closed === true;
    default:
      return false;
  }
}

/** Legacy event-in-range matching (timestamps in the selected window). */
export function leadMatchesFunnelStage(
  lead: LeadRow,
  stage: FunnelEventStage,
  fromISO: string,
  toISO: string
): boolean {
  switch (stage) {
    case "created":
      return eventInRange(lead.created_at, fromISO, toISO);
    case "call_booked": {
      if (!eventInRange(lead.call_booked_at, fromISO, toISO)) return false;
      if (!lead.call_cancelled_at) return true;
      return Boolean(lead.call_booked_at && lead.call_booked_at > lead.call_cancelled_at);
    }
    case "qualified_call_booked":
      // No dedicated confirmed_at; approximate with booking time when confirmed.
      return (
        lead.call_confirmed === true &&
        eventInRange(lead.call_booked_at, fromISO, toISO)
      );
    case "show_up":
      return lead.call_showed === true && eventInRange(lead.call_showed_at, fromISO, toISO);
    case "closed":
      return lead.deal_closed === true && eventInRange(lead.closed_at, fromISO, toISO);
    default:
      return false;
  }
}

export function funnelEventField(stage: FunnelEventStage): string {
  return FUNNEL_STAGE_EVENT_FIELD[stage];
}
