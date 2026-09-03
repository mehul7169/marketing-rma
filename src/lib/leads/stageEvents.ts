import type { LeadRow } from "@/lib/leads/types";
import { toISTDateString } from "@/lib/timezone";

/**
 * Funnel stage keys shared by Overview cards and /leads deep links.
 * Cohort counting: created_at in range, then "ever reached" via raw fields.
 */
export const FUNNEL_STAGE_EVENT_FIELD = {
  lead: "created_at",
  form_filled: "form_filled_at",
  form_qualified: "qualified_at",
  booked: "call_booked_at",
  verified: "setter_verified_at",
  showed: "call_showed_at",
  closed: "closed_at"
} as const;

export type FunnelEventStage = keyof typeof FUNNEL_STAGE_EVENT_FIELD;

/** URL `?cohort=` / legacy `?event=` values (qualified ≠ form_qualified). */
export const URL_EVENT_KEYS = {
  form_filled: "form_filled",
  qualified: "form_qualified",
  booked: "booked",
  verified: "verified",
  showed: "showed",
  closed: "closed"
} as const;

export type UrlEventKey = keyof typeof URL_EVENT_KEYS;

export function isFunnelEventStage(stage: string): stage is FunnelEventStage {
  return stage in FUNNEL_STAGE_EVENT_FIELD;
}

export function parseUrlEvent(value: string | undefined): FunnelEventStage | null {
  if (!value) return null;
  const mapped = URL_EVENT_KEYS[value as UrlEventKey];
  return mapped ?? null;
}

export function urlCohortForFunnelStage(stage: FunnelEventStage): string | null {
  if (stage === "lead") return null;
  if (stage === "form_qualified") return "qualified";
  return stage;
}

export function cohortBannerCopy(stage: FunnelEventStage): string {
  const phrases: Record<Exclude<FunnelEventStage, "lead">, string> = {
    form_filled: "filled the form",
    form_qualified: "were marked qualified",
    booked: "booked a call",
    verified: "were setter-verified",
    showed: "showed up",
    closed: "closed a deal"
  };
  if (stage === "lead") {
    return "Showing the cohort of leads created in this range.";
  }
  return `Showing cohort leads (created in this range) who ${phrases[stage]}, including those who have since moved further.`;
}

export function eventBannerCopy(stage: FunnelEventStage): string {
  const phrases: Record<Exclude<FunnelEventStage, "lead">, string> = {
    form_filled: "filled the form",
    form_qualified: "were marked qualified",
    booked: "booked a call",
    verified: "were setter-verified",
    showed: "showed up",
    closed: "closed a deal"
  };
  if (stage === "lead") {
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
 * Cohort member reached this funnel stage at any time (raw field set).
 * Cohort membership itself is created_at in range — apply that separately.
 */
export function leadReachedCohortStage(lead: LeadRow, stage: FunnelEventStage): boolean {
  switch (stage) {
    case "lead":
      return true;
    case "form_filled":
      return Boolean(lead.form_filled_at);
    case "form_qualified":
      return lead.qualified === true;
    case "booked":
      return Boolean(lead.call_booked_at);
    case "verified":
      return lead.setter_verified === true;
    case "showed":
      return lead.call_showed === true;
    case "closed":
      return lead.deal_closed === true;
    default:
      return false;
  }
}

/** Legacy event-in-range matching (call_showed_at etc. in the selected window). */
export function leadMatchesFunnelStage(
  lead: LeadRow,
  stage: FunnelEventStage,
  fromISO: string,
  toISO: string
): boolean {
  switch (stage) {
    case "lead":
      return eventInRange(lead.created_at, fromISO, toISO);
    case "form_filled":
      return eventInRange(lead.form_filled_at, fromISO, toISO);
    case "form_qualified":
      return lead.qualified === true && eventInRange(lead.qualified_at, fromISO, toISO);
    case "booked": {
      if (!eventInRange(lead.call_booked_at, fromISO, toISO)) return false;
      if (!lead.call_cancelled_at) return true;
      return Boolean(lead.call_booked_at && lead.call_booked_at > lead.call_cancelled_at);
    }
    case "verified":
      return (
        lead.setter_verified === true &&
        eventInRange(lead.setter_verified_at, fromISO, toISO)
      );
    case "showed":
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
