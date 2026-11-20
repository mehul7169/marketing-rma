/**
 * Pure planner for deal actions (call_showed = true). Client-safe for optimistic
 * UI; the server executor is updateDeal. is_dead is a pre-call flag and is
 * never read or written here.
 */

import type {
  LifecycleActor,
  LifecyclePlan,
  PlannedActivity
} from "@/lib/leads/lifecycle";
import type { LeadRow } from "@/lib/leads/types";
import { formatIST } from "@/lib/timezone";

export type DealAction =
  | "log_follow_up"
  | "set_next_step"
  | "change_stage"
  | "assign_owner"
  | "set_value"
  | "mark_won"
  | "mark_lost"
  | "reopen";

export const DEAL_STAGES = [
  "follow_up_call_booked",
  "awaiting_lead_response",
  "contract_shared",
  "awaiting_payment"
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  follow_up_call_booked: "Follow-up call booked",
  awaiting_lead_response: "Awaiting lead response",
  contract_shared: "Proposal sent",
  awaiting_payment: "Awaiting payment"
};

export const DEAL_FOLLOW_UP_OUTCOMES = [
  "spoke",
  "no_answer",
  "sent_proposal",
  "payment_link_sent",
  "rescheduled_call",
  "other"
] as const;
export type DealFollowUpOutcome = (typeof DEAL_FOLLOW_UP_OUTCOMES)[number];

export const LOST_REASONS = [
  "price",
  "timing",
  "not_a_fit",
  "ghosted",
  "chose_someone_else",
  "other"
] as const;
export type LostReason = (typeof LOST_REASONS)[number];

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  price: "Price",
  timing: "Timing",
  not_a_fit: "Not a fit",
  ghosted: "Ghosted",
  chose_someone_else: "Chose someone else",
  other: "Other"
};

export type DealPayload = {
  outcome?: DealFollowUpOutcome;
  note?: string | null;
  next_step?: string | null;
  next_action_at?: string | null;
  /** Required when next_action_at is in the past. */
  confirmPast?: boolean;
  /** change_stage / optional log_follow_up. null = Showed up. */
  stage?: DealStage | null;
  ownerId?: string | null;
  value?: number | null;
  closedAt?: string | null;
  lostReason?: LostReason;
};

export type DealPlan = LifecyclePlan;

export const DEAL_ERRORS = {
  notADeal: "This lead has not shown up, so it is not a deal.",
  notOpen: "This deal is already closed.",
  notClosed: "This deal is still open.",
  nextStepRequired: "Set the next step (what and when).",
  nextStepWhat: "Say what the next step is.",
  nextStepWhen: "Pick when the next step is due.",
  confirmPast: "This next step is in the past. Confirm to continue.",
  invalidWhen: "Pick a valid date and time.",
  invalidOutcome: "Pick a follow-up outcome.",
  invalidStage: "Pick a valid deal stage.",
  invalidOwner: "Pick a valid owner.",
  ownerNotMember: "Owner must be a member of this org.",
  valueRequired: "Enter a value of 0 or more.",
  lostReasonRequired: "Pick a lost reason.",
  reopenReasonRequired: "Give a reason for reopening."
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDealStage(value: string | null | undefined): value is DealStage {
  return value != null && (DEAL_STAGES as readonly string[]).includes(value);
}

export function isLostReason(value: string | null | undefined): value is LostReason {
  return value != null && (LOST_REASONS as readonly string[]).includes(value);
}

export function dealStageLabel(stage: string | null | undefined): string {
  if (!stage) return "Showed up";
  return isDealStage(stage) ? DEAL_STAGE_LABELS[stage] : stage;
}

export function lostReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return isLostReason(reason) ? LOST_REASON_LABELS[reason] : reason;
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

type DealLead = Pick<
  LeadRow,
  | "call_showed"
  | "deal_closed"
  | "post_call_status"
  | "next_step"
  | "next_action_at"
  | "deal_value"
  | "lost_reason"
  | "closed_at"
>;

/** Drawer / list status line. Example: Deal: Open · Proposal sent · Next: Call about pricing, 22 Nov 3:00 PM */
export function formatDealStatusLine(lead: DealLead): string {
  if (lead.call_showed !== true) return "";
  if (lead.deal_closed === true) {
    const when = lead.closed_at ? formatIST(lead.closed_at, "d MMM") : null;
    return when ? `Deal: Won · Closed ${when}` : "Deal: Won";
  }
  if (lead.deal_closed === false) {
    const reason = lostReasonLabel(lead.lost_reason);
    return reason ? `Deal: Lost · ${reason}` : "Deal: Lost";
  }
  const parts = ["Deal: Open", dealStageLabel(lead.post_call_status)];
  const what = lead.next_step?.trim() || "";
  if (!what || !lead.next_action_at) {
    parts.push("Needs next step");
  } else {
    parts.push(`Next: ${what}, ${formatIST(lead.next_action_at, "d MMM h:mm a")}`);
  }
  return parts.join(" · ");
}

type Ctx = { actor: LifecycleActor; now: string };

class Draft {
  patch: Partial<LeadRow> = {};
  activities: PlannedActivity[] = [];
  constructor(public lead: LeadRow) {}
  set(p: Partial<LeadRow>) {
    Object.assign(this.patch, p);
    this.lead = { ...this.lead, ...p };
  }
  log(type: string, outcome: string | null, note?: string | null, next_action_at?: string | null) {
    const a: PlannedActivity = { type, outcome, note: note?.trim() || null };
    if (next_action_at) a.next_action_at = next_action_at;
    this.activities.push(a);
  }
}

function isOpen(lead: LeadRow): boolean {
  return lead.deal_closed === null;
}

function parseWhen(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : value;
}

function requireNextStep(
  p: DealPayload,
  ctx: Ctx
): { error: string } | { next_step: string; next_action_at: string } {
  const next_step = p.next_step?.trim() ?? "";
  if (!next_step && !p.next_action_at) {
    return { error: DEAL_ERRORS.nextStepRequired };
  }
  if (!next_step) return { error: DEAL_ERRORS.nextStepWhat };
  const next_action_at = parseWhen(p.next_action_at);
  if (!p.next_action_at) return { error: DEAL_ERRORS.nextStepWhen };
  if (!next_action_at) return { error: DEAL_ERRORS.invalidWhen };
  if (Date.parse(next_action_at) < Date.parse(ctx.now) && !p.confirmPast) {
    return { error: DEAL_ERRORS.confirmPast };
  }
  return { next_step, next_action_at };
}

function requireNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

type Step = (d: Draft, payload: DealPayload, ctx: Ctx) => string | null;

const logFollowUp: Step = (d, p, ctx) => {
  if (!isOpen(d.lead)) return DEAL_ERRORS.notOpen;
  if (!p.outcome || !(DEAL_FOLLOW_UP_OUTCOMES as readonly string[]).includes(p.outcome)) {
    return DEAL_ERRORS.invalidOutcome;
  }
  const next = requireNextStep(p, ctx);
  if ("error" in next) return next.error;
  if (p.stage !== undefined && p.stage !== null && !isDealStage(p.stage)) {
    return DEAL_ERRORS.invalidStage;
  }
  const patch: Partial<LeadRow> = {
    next_step: next.next_step,
    next_action_at: next.next_action_at,
    last_action: `Follow-up: ${p.outcome}`,
    last_action_at: ctx.now
  };
  if (p.stage !== undefined) {
    patch.post_call_status = p.stage;
    patch.post_call_status_updated_at = ctx.now;
    patch.post_call_status_updated_by = ctx.actor.email;
  }
  d.set(patch);
  d.log("deal_follow_up", p.outcome, p.note, next.next_action_at);
  return null;
};

const setNextStep: Step = (d, p, ctx) => {
  if (!isOpen(d.lead)) return DEAL_ERRORS.notOpen;
  const next = requireNextStep(p, ctx);
  if ("error" in next) return next.error;
  d.set({
    next_step: next.next_step,
    next_action_at: next.next_action_at
  });
  d.log("deal_next_step_set", null, next.next_step, next.next_action_at);
  return null;
};

const changeStage: Step = (d, p, ctx) => {
  if (!isOpen(d.lead)) return DEAL_ERRORS.notOpen;
  if (p.stage !== null && !isDealStage(p.stage)) return DEAL_ERRORS.invalidStage;
  d.set({
    post_call_status: p.stage ?? null,
    post_call_status_updated_at: ctx.now,
    post_call_status_updated_by: ctx.actor.email
  });
  d.log("deal_stage_changed", p.stage ?? "showed_up");
  return null;
};

const assignOwner: Step = (d, p) => {
  if (p.ownerId === undefined) return DEAL_ERRORS.invalidOwner;
  if (p.ownerId !== null && !isUuid(p.ownerId)) return DEAL_ERRORS.invalidOwner;
  d.set({ owner_id: p.ownerId });
  d.log("deal_owner_changed", p.ownerId ?? "unassigned");
  return null;
};

const setValue: Step = (d, p) => {
  const value = requireNonNegative(p.value);
  if (value === null) return DEAL_ERRORS.valueRequired;
  d.set({ deal_value: value });
  d.log("field_edited", null, "deal_value");
  return null;
};

const markWon: Step = (d, p, ctx) => {
  if (!isOpen(d.lead)) return DEAL_ERRORS.notOpen;
  if (p.value !== undefined && p.value !== null && requireNonNegative(p.value) === null) {
    return DEAL_ERRORS.valueRequired;
  }
  const closedAt = p.closedAt ? parseWhen(p.closedAt) : ctx.now;
  if (p.closedAt && !closedAt) return DEAL_ERRORS.invalidWhen;
  const patch: Partial<LeadRow> = {
    deal_closed: true,
    closed_at: closedAt,
    closed_by: ctx.actor.email,
    next_step: null,
    next_action_at: null,
    last_action: "Deal won",
    last_action_at: ctx.now
  };
  if (typeof p.value === "number") patch.deal_value = p.value;
  d.set(patch);
  d.log("deal_outcome", "won");
  return null;
};

const markLost: Step = (d, p, ctx) => {
  if (!isOpen(d.lead)) return DEAL_ERRORS.notOpen;
  if (!isLostReason(p.lostReason)) return DEAL_ERRORS.lostReasonRequired;
  const closedAt = p.closedAt ? parseWhen(p.closedAt) : ctx.now;
  if (p.closedAt && !closedAt) return DEAL_ERRORS.invalidWhen;
  const note = [p.lostReason, p.note?.trim()].filter(Boolean).join(": ");
  d.set({
    deal_closed: false,
    lost_reason: p.lostReason,
    closed_at: closedAt,
    closed_by: ctx.actor.email,
    next_step: null,
    next_action_at: null,
    last_action: "Deal lost",
    last_action_at: ctx.now
  });
  d.log("deal_outcome", "lost", note);
  return null;
};

const reopen: Step = (d, p, ctx) => {
  if (isOpen(d.lead)) return DEAL_ERRORS.notClosed;
  const reason = p.note?.trim() || "";
  if (!reason) return DEAL_ERRORS.reopenReasonRequired;
  const next = requireNextStep(p, ctx);
  if ("error" in next) return next.error;
  d.set({
    deal_closed: null,
    lost_reason: null,
    closed_at: null,
    closed_by: null,
    next_step: next.next_step,
    next_action_at: next.next_action_at,
    last_action: "Deal reopened",
    last_action_at: ctx.now
  });
  d.log("deal_reopened", null, reason, next.next_action_at);
  return null;
};

const STEPS: Record<DealAction, Step> = {
  log_follow_up: logFollowUp,
  set_next_step: setNextStep,
  change_stage: changeStage,
  assign_owner: assignOwner,
  set_value: setValue,
  mark_won: markWon,
  mark_lost: markLost,
  reopen
};

export function planDeal(
  lead: LeadRow,
  action: DealAction,
  payload: DealPayload,
  actor: LifecycleActor,
  opts: { now?: string } = {}
): DealPlan {
  if (lead.call_showed !== true) return { ok: false, error: DEAL_ERRORS.notADeal };
  const step = STEPS[action];
  if (!step) return { ok: false, error: `Unknown action: ${action}` };
  const ctx: Ctx = { actor, now: opts.now ?? new Date().toISOString() };
  const draft = new Draft(lead);
  const error = step(draft, payload, ctx);
  if (error) return { ok: false, error };
  return { ok: true, patch: draft.patch, activities: draft.activities };
}
