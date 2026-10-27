/**
 * Single source of truth for lead lifecycle vocabulary. Every count, filter,
 * cohort deep link and badge imports from here.
 *
 * - Stage = leads.pipeline_stage (generated column, migration 008).
 * - Overlays: Dead, Needs qualification, Form Qualified, Follow-up colour.
 * - KPIs are milestone-based: a lead counts in the range its milestone
 *   timestamp falls in (full IST days, inclusive), even if it later died.
 */
import type { LeadRow, PipelineStage } from "@/lib/leads/types";
import { toISTDateString, todayISTDateString } from "@/lib/timezone";

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  "new",
  "contacted",
  "qualified",
  "call_booked",
  "showed_up"
];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  call_booked: "Call Booked",
  showed_up: "Showed Up"
};

export function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value);
}

type StageFields = Pick<
  LeadRow,
  "call_showed" | "call_booked_at" | "qualified" | "first_contacted_at"
> & { pipeline_stage?: PipelineStage | null };

/** Mirrors the generated column so optimistic (unsaved) rows render the same. */
export function pipelineStageOf(lead: StageFields): PipelineStage {
  if (lead.call_showed === true) return "showed_up";
  if (lead.call_booked_at) return "call_booked";
  if (lead.qualified === true) return "qualified";
  if (lead.first_contacted_at) return "contacted";
  return "new";
}

export function pipelineStageLabel(stage: string | null | undefined): string {
  return stage && isPipelineStage(stage) ? PIPELINE_STAGE_LABELS[stage] : "New";
}

// ---------------------------------------------------------------------------
// Overlays / badges
// ---------------------------------------------------------------------------

/** Booked but the setter hasn't decided Qualified yes/no. */
export function needsQualification(
  lead: Pick<LeadRow, "call_booked_at" | "qualified">
): boolean {
  return Boolean(lead.call_booked_at) && lead.qualified === null;
}

/** Work Queue default-hides these (form said no, setter hasn't overridden). */
export function isFormUnqualified(
  lead: Pick<LeadRow, "form_qualified" | "qualified">
): boolean {
  return lead.form_qualified === false && lead.qualified === null;
}

export type FollowUpState = "overdue" | "today" | "upcoming";

export const FOLLOW_UP_LABELS: Record<FollowUpState, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming"
};

/** Render-time only, by IST calendar day. Never stored. */
export function followUpState(
  nextActionAt: string | null | undefined,
  todayISO: string = todayISTDateString()
): FollowUpState | null {
  if (!nextActionAt) return null;
  const day = toISTDateString(nextActionAt);
  if (!day) return null;
  if (day < todayISO) return "overdue";
  if (day === todayISO) return "today";
  return "upcoming";
}

/** grey future, amber today, red past. */
export const FOLLOW_UP_STYLES: Record<FollowUpState, string> = {
  upcoming: "bg-slate-100 text-slate-700",
  today: "bg-amber-50 text-amber-900",
  overdue: "bg-red-50 text-red-800"
};

// ---------------------------------------------------------------------------
// KPIs (milestone-based)
// ---------------------------------------------------------------------------

export type KpiKey =
  | "leads"
  | "contacted"
  | "qualified"
  | "calls_booked"
  | "showups"
  | "qualified_showups"
  | "form_qualified_opt_ins"
  | "deals_closed";

type KpiField =
  | "created_at"
  | "first_contacted_at"
  | "qualified_at"
  | "call_booked_at"
  | "call_showed_at"
  | "closed_at";

type KpiFlag = "qualified" | "call_showed" | "form_qualified" | "deal_closed";

export type KpiDefinition = {
  label: string;
  /** Timestamp the KPI is bucketed by. */
  field: KpiField;
  /** Boolean columns that must be true. */
  requireTrue: readonly KpiFlag[];
};

export const KPI_DEFINITIONS: Record<KpiKey, KpiDefinition> = {
  leads: { label: "Leads", field: "created_at", requireTrue: [] },
  contacted: { label: "Contacted", field: "first_contacted_at", requireTrue: [] },
  qualified: { label: "Qualified", field: "qualified_at", requireTrue: ["qualified"] },
  calls_booked: { label: "Calls Booked", field: "call_booked_at", requireTrue: [] },
  showups: { label: "Showups", field: "call_showed_at", requireTrue: ["call_showed"] },
  qualified_showups: {
    label: "Qualified Showups",
    field: "call_showed_at",
    requireTrue: ["call_showed", "qualified"]
  },
  form_qualified_opt_ins: {
    label: "Form-qualified opt-ins",
    field: "created_at",
    requireTrue: ["form_qualified"]
  },
  // Post-call; kept here so deep links and Home share one definition.
  deals_closed: { label: "Deals Closed", field: "closed_at", requireTrue: ["deal_closed"] }
};

/** Home funnel and in-app KPI deep links, in pipeline order. */
export const HOME_FUNNEL_KPIS: readonly KpiKey[] = [
  "leads",
  "contacted",
  "qualified",
  "calls_booked",
  "showups",
  "qualified_showups"
];

export const KPI_KEYS = Object.keys(KPI_DEFINITIONS) as KpiKey[];

export function isKpiKey(value: string | null | undefined): value is KpiKey {
  return Boolean(value) && value! in KPI_DEFINITIONS;
}

export type KpiLead = Pick<LeadRow, KpiField | KpiFlag>;

/** Milestone reached at all (ignores date range). */
export function leadReachedKpi(lead: KpiLead, kpi: KpiKey): boolean {
  const def = KPI_DEFINITIONS[kpi];
  if (!lead[def.field]) return false;
  return def.requireTrue.every((flag) => lead[flag] === true);
}

/** Milestone reached with its timestamp inside [fromISO, toISO] IST days. */
export function leadHitsKpiInRange(
  lead: KpiLead,
  kpi: KpiKey,
  fromISO: string,
  toISO: string
): boolean {
  if (!leadReachedKpi(lead, kpi)) return false;
  const day = toISTDateString(lead[KPI_DEFINITIONS[kpi].field] as string);
  return day >= fromISO && day <= toISO;
}

export function countKpi(
  leads: readonly KpiLead[],
  kpi: KpiKey,
  fromISO: string,
  toISO: string
): number {
  let n = 0;
  for (const lead of leads) if (leadHitsKpiInRange(lead, kpi, fromISO, toISO)) n += 1;
  return n;
}

export function kpiBannerCopy(kpi: KpiKey): string {
  const def = KPI_DEFINITIONS[kpi];
  if (kpi === "leads") return "Showing leads created in this range.";
  return `Showing ${def.label} — leads whose ${def.field} falls in this range (IST), including those who have since died or moved further.`;
}
