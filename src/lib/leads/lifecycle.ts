import {
  callAttemptSummary,
  nextTouchpointAt,
  type CallAttemptOutcome
} from "@/lib/leads/actionStatus";
import {
  CANCEL_BOOKING_UNDO_MS,
  isWorkQueueQualifyAndBook,
  latestCancelEntry
} from "@/lib/leads/cancelBooking";
import type {
  BookingHistoryEntry,
  CancelBookingReason,
  DeadReasonCode,
  LeadRow
} from "@/lib/leads/types";
import { isCancelBookingReason } from "@/lib/leads/types";

/**
 * Pure planner for every lifecycle action: validation, the lead patch, and the
 * lead_activities rows. Client-safe (the Work Queue reuses it for optimistic UI);
 * the server executor is updateLeadLifecycle.
 */

export type LifecycleAction =
  | "log_call_attempt"
  | "qualify"
  | "disqualify"
  | "clear_qualification"
  | "book_call"
  | "reschedule_call"
  | "cancel_call"
  | "cancel_booking"
  | "undo_cancel_booking"
  | "mark_showed"
  | "mark_no_show"
  | "clear_show"
  | "mark_dead"
  | "revive"
  | "set_follow_up";

export type LogCallOutcome = Extract<
  CallAttemptOutcome,
  "no_answer" | "follow_up_needed" | "qualified" | "not_qualified"
>;
export const LOG_CALL_OUTCOMES: LogCallOutcome[] = [
  "no_answer",
  "follow_up_needed",
  "qualified",
  "not_qualified"
];

export type LifecyclePayload = {
  /** log_call_attempt */
  outcome?: LogCallOutcome;
  note?: string | null;
  /** Required for clear_qualification, clear_show, cancel_booking. */
  reason?: string | null;
  /** logged_by_mistake on a Work Queue qualify+book. */
  undoQualification?: boolean;
  /** mark_dead */
  deadReason?: DeadReasonCode | null;
  /** ISO. follow_up_needed outcome, set_follow_up. */
  followUpAt?: string | null;
  /** ISO. book_call, reschedule_call, qualified outcome. */
  scheduledFor?: string | null;
  /** book_call from cal.com ingestion. */
  calComBookingId?: string | null;
};

export type LifecycleActor = { userId: string | null; email: string | null };

/** Ingestion paths (cal.com booking, Quickform "call booked") skip the contacted gate. */
export type LifecycleSource = "manual" | "cal_com" | "quickform";

export type PlannedActivity = {
  type: string;
  outcome: string | null;
  note: string | null;
  next_action_at?: string | null;
};

export type LifecyclePlan =
  | { ok: true; patch: Partial<LeadRow>; activities: PlannedActivity[] }
  | { ok: false; error: string };

export const LIFECYCLE_ERRORS = {
  bookBeforeContact: "Log a call attempt before booking a call.",
  alreadyBooked: "This call is already booked. Reschedule it instead.",
  notBooked: "There is no booked call on this lead.",
  cancelAfterShow: "This call already happened. Mark the deal lost instead.",
  showedNeedsBooking: "Book a call before marking it as showed.",
  qualifyDead: "This lead is dead. Revive it before qualifying.",
  notDead: "This lead is not dead.",
  alreadyDead: "This lead is already dead.",
  reasonRequired: "Give a short reason.",
  cancelReasonRequired: "Pick a cancel reason.",
  otherNoteRequired: "Add a note for Other.",
  scheduledForRequired: "Pick a date and time for the call.",
  followUpRequired: "Pick a follow-up date.",
  invalidOutcome: "Invalid call outcome.",
  nothingToUndo: "There is no cancelled booking to restore.",
  undoExpired: "Undo window has closed. Book the call again."
} as const;

/** dead_reason values (codes and legacy text) that mean "disqualified by setter". */
const NOT_QUALIFIED_REASONS = new Set(["not_qualified", "reached lead, confirmed not qualified"]);

type Ctx = { actor: LifecycleActor; now: string; source: LifecycleSource };

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

type Step = (d: Draft, payload: LifecyclePayload, ctx: Ctx) => string | null;

function historyEntry(d: Draft, scheduledFor: string, ctx: Ctx): BookingHistoryEntry[] {
  return [
    ...(d.lead.booking_history ?? []),
    {
      changed_at: ctx.now,
      previous_scheduled_for: d.lead.call_scheduled_for,
      new_scheduled_for: scheduledFor,
      source: ctx.source === "cal_com" ? "cal_com" : "manual",
      changed_by: ctx.actor.email ?? ctx.source
    }
  ];
}

function cancelHistoryEntry(
  d: Draft,
  ctx: Ctx,
  reason: CancelBookingReason
): BookingHistoryEntry[] {
  return [
    ...(d.lead.booking_history ?? []),
    {
      changed_at: ctx.now,
      previous_scheduled_for: d.lead.call_scheduled_for,
      new_scheduled_for: null,
      source: d.lead.booking_source ?? (ctx.source === "cal_com" ? "cal_com" : "manual"),
      changed_by: ctx.actor.email ?? ctx.source,
      cancelled_at: ctx.now,
      reason,
      by: ctx.actor.email ?? ctx.source,
      previous_call_booked_at: d.lead.call_booked_at
    }
  ];
}

const qualify: Step = (d, p, ctx) => {
  if (d.lead.is_dead) return LIFECYCLE_ERRORS.qualifyDead;
  d.set({
    qualified: true,
    qualified_at: ctx.now,
    qualified_by: ctx.actor.email,
    last_action: "Marked Qualified",
    last_action_at: ctx.now
  });
  d.log("qualification", "qualified", p.note);
  return null;
};

const disqualify: Step = (d, p, ctx) => {
  d.set({
    qualified: false,
    qualified_at: ctx.now,
    qualified_by: ctx.actor.email,
    is_dead: true,
    dead_reason: "not_qualified",
    next_action_at: null,
    last_action: "Marked Unqualified",
    last_action_at: ctx.now
  });
  d.log("qualification", "unqualified", p.note);
  return null;
};

const clearQualification: Step = (d, p, ctx) => {
  if (!p.reason?.trim()) return LIFECYCLE_ERRORS.reasonRequired;
  d.set({
    qualified: null,
    qualified_at: null,
    qualified_by: null,
    last_action: "Qualification cleared",
    last_action_at: ctx.now
  });
  d.log("qualification", "cleared", p.reason);
  return null;
};

const bookCall: Step = (d, p, ctx) => {
  if (ctx.source === "manual" && !d.lead.first_contacted_at) {
    return LIFECYCLE_ERRORS.bookBeforeContact;
  }
  if (d.lead.call_booked_at) return LIFECYCLE_ERRORS.alreadyBooked;
  const scheduledFor = p.scheduledFor ?? null;
  if (!scheduledFor) return LIFECYCLE_ERRORS.scheduledForRequired;
  const patch: Partial<LeadRow> = {
    call_booked_at: ctx.now,
    call_scheduled_for: scheduledFor,
    last_action: "Call scheduled",
    last_action_at: ctx.now
  };
  if (ctx.source === "cal_com") {
    patch.booking_source = "cal_com";
    if (p.calComBookingId) patch.cal_com_booking_id = p.calComBookingId;
  } else if (ctx.source === "manual") {
    patch.booking_source = "manual";
    patch.booking_history = historyEntry(d, scheduledFor, ctx);
  }
  d.set(patch);
  d.log("schedule", null, p.note);
  return null;
};

const rescheduleCall: Step = (d, p, ctx) => {
  if (!d.lead.call_booked_at) return LIFECYCLE_ERRORS.notBooked;
  const scheduledFor = p.scheduledFor ?? null;
  if (!scheduledFor) return LIFECYCLE_ERRORS.scheduledForRequired;
  const patch: Partial<LeadRow> = {
    call_scheduled_for: scheduledFor,
    booking_history: historyEntry(d, scheduledFor, ctx),
    call_showed: null,
    call_showed_at: null,
    call_showed_by: null,
    last_action: "Call rescheduled",
    last_action_at: ctx.now
  };
  // Rebooking a no-show brings the lead back.
  if (d.lead.is_dead && d.lead.dead_reason === "no_show") {
    patch.is_dead = false;
    patch.dead_reason = null;
  }
  d.set(patch);
  d.log("reschedule", null, p.note);
  return null;
};

const cancelBooking: Step = (d, p, ctx) => {
  if (!d.lead.call_booked_at) return LIFECYCLE_ERRORS.notBooked;
  if (d.lead.call_showed === true) return LIFECYCLE_ERRORS.cancelAfterShow;
  const reasonRaw = p.reason?.trim() ?? "";
  if (!reasonRaw || !isCancelBookingReason(reasonRaw)) {
    return LIFECYCLE_ERRORS.cancelReasonRequired;
  }
  const note = p.note?.trim() || null;
  if (reasonRaw === "other" && !note) return LIFECYCLE_ERRORS.otherNoteRequired;
  if (reasonRaw === "unreachable" && !p.followUpAt) {
    return LIFECYCLE_ERRORS.followUpRequired;
  }

  const undoQual =
    reasonRaw === "logged_by_mistake" &&
    Boolean(p.undoQualification) &&
    isWorkQueueQualifyAndBook(d.lead);

  d.set({
    call_booked_at: null,
    call_scheduled_for: null,
    booking_history: cancelHistoryEntry(d, ctx, reasonRaw),
    last_action: "Booking cancelled",
    last_action_at: ctx.now
  });
  d.log(
    "call_cancelled",
    reasonRaw,
    note,
    reasonRaw === "unreachable" ? p.followUpAt ?? undefined : undefined
  );

  if (reasonRaw === "not_qualified") {
    return disqualify(d, { note }, ctx);
  }
  if (reasonRaw === "unreachable") {
    d.set({ next_action_at: p.followUpAt });
  }
  if (undoQual) {
    d.set({
      qualified: null,
      qualified_at: null,
      qualified_by: null
    });
    d.log("qualification", "cleared", "Undo qualification with mistaken booking");
  }
  return null;
};

const undoCancelBooking: Step = (d, p, ctx) => {
  if (d.lead.call_booked_at) return LIFECYCLE_ERRORS.alreadyBooked;
  const last = latestCancelEntry(d.lead.booking_history);
  if (!last) return LIFECYCLE_ERRORS.nothingToUndo;
  const age = new Date(ctx.now).getTime() - new Date(last.cancelled_at).getTime();
  if (age > CANCEL_BOOKING_UNDO_MS) return LIFECYCLE_ERRORS.undoExpired;
  const hist = [...(d.lead.booking_history ?? [])];
  const idx = hist.lastIndexOf(last);
  if (idx >= 0) hist.splice(idx, 1);
  d.set({
    call_booked_at: last.previous_call_booked_at ?? last.cancelled_at,
    call_scheduled_for: last.previous_scheduled_for,
    booking_history: hist,
    last_action: "Call scheduled",
    last_action_at: ctx.now
  });
  d.log("schedule", null, "Undo cancel booking");
  return null;
};

const markShowed: Step = (d, p, ctx) => {
  if (!d.lead.call_booked_at) return LIFECYCLE_ERRORS.showedNeedsBooking;
  const patch: Partial<LeadRow> = {
    call_showed: true,
    call_showed_at: d.lead.call_showed_at ?? ctx.now,
    call_showed_by: ctx.actor.email,
    last_action: "Call showed",
    last_action_at: ctx.now
  };
  if (d.lead.owner_id == null && ctx.actor.userId) {
    patch.owner_id = ctx.actor.userId;
  }
  // Correcting a no-show.
  if (d.lead.is_dead && d.lead.dead_reason === "no_show") {
    patch.is_dead = false;
    patch.dead_reason = null;
  }
  d.set(patch);
  d.log("show_outcome", "showed", p.note);
  return null;
};

const markNoShow: Step = (d, p, ctx) => {
  if (!d.lead.call_booked_at) return LIFECYCLE_ERRORS.notBooked;
  d.set({
    call_showed: false,
    call_showed_at: null,
    call_showed_by: ctx.actor.email,
    is_dead: true,
    dead_reason: "no_show",
    next_action_at: null,
    last_action: "Call no-show",
    last_action_at: ctx.now
  });
  d.log("show_outcome", "no_show", p.note);
  return null;
};

const clearShow: Step = (d, p, ctx) => {
  if (!p.reason?.trim()) return LIFECYCLE_ERRORS.reasonRequired;
  const patch: Partial<LeadRow> = {
    call_showed: null,
    call_showed_at: null,
    call_showed_by: null,
    last_action: "Show outcome cleared",
    last_action_at: ctx.now
  };
  if (d.lead.is_dead && d.lead.dead_reason === "no_show") {
    patch.is_dead = false;
    patch.dead_reason = null;
  }
  d.set(patch);
  d.log("show_outcome", "cleared", p.reason);
  return null;
};

const markDead: Step = (d, p, ctx) => {
  if (d.lead.is_dead) return LIFECYCLE_ERRORS.alreadyDead;
  d.set({
    is_dead: true,
    dead_reason: p.deadReason ?? null,
    next_action_at: null,
    last_action: "Marked dead",
    last_action_at: ctx.now
  });
  d.log("marked_dead", p.deadReason ?? null, p.note);
  return null;
};

const revive: Step = (d, p, ctx) => {
  if (!d.lead.is_dead) return LIFECYCLE_ERRORS.notDead;
  const note = p.note?.trim() || null;
  const patch: Partial<LeadRow> = {
    is_dead: false,
    dead_reason: null,
    contact_attempts: 0,
    next_action_at: null,
    last_action: note ? `Revived — ${note}` : "Revived",
    last_action_at: ctx.now
  };
  if (d.lead.dead_reason && NOT_QUALIFIED_REASONS.has(d.lead.dead_reason)) {
    patch.qualified = null;
    patch.qualified_at = null;
    patch.qualified_by = null;
  }
  d.set(patch);
  d.log("revive", null, note);
  return null;
};

const setFollowUp: Step = (d, p, ctx) => {
  if (!p.followUpAt) return LIFECYCLE_ERRORS.followUpRequired;
  d.set({
    next_action_at: p.followUpAt,
    last_action: "Follow-up set",
    last_action_at: ctx.now
  });
  d.log("follow_up_set", null, p.note, p.followUpAt);
  return null;
};

/** Calling cadence: counter, 3rd no-answer → dead, plus the Contacted milestone. */
const logCallAttempt: Step = (d, p, ctx) => {
  const outcome = p.outcome;
  if (!outcome || !LOG_CALL_OUTCOMES.includes(outcome)) return LIFECYCLE_ERRORS.invalidOutcome;
  if (outcome === "follow_up_needed" && !p.followUpAt) return LIFECYCLE_ERRORS.followUpRequired;

  const attempts = (d.lead.contact_attempts ?? 0) + 1;
  d.set({
    contact_attempts: attempts,
    first_contacted_at: d.lead.first_contacted_at ?? ctx.now
  });
  // Insights / Slack count this row; it stays first and unchanged.
  d.log("call_attempt", outcome, p.note);

  let error: string | null = null;
  if (outcome === "no_answer") {
    if (attempts >= 3) {
      d.set({ is_dead: true, dead_reason: "no_answer", next_action_at: null });
    } else {
      d.set({ next_action_at: nextTouchpointAt(new Date(ctx.now)), is_dead: false });
    }
  } else if (outcome === "follow_up_needed") {
    d.set({ next_action_at: p.followUpAt });
  } else if (outcome === "qualified") {
    // Work Queue "Qualified" = qualified AND call booked, as one explicit step.
    const scheduledFor = p.scheduledFor ?? d.lead.call_scheduled_for;
    if (!scheduledFor) return LIFECYCLE_ERRORS.scheduledForRequired;
    error = qualify(d, {}, ctx);
    if (!error && !d.lead.call_booked_at) {
      error = bookCall(d, { scheduledFor }, ctx);
    } else if (!error && scheduledFor !== d.lead.call_scheduled_for) {
      d.set({ call_scheduled_for: scheduledFor });
    }
    if (!error) d.set({ contact_attempts: 0, next_action_at: null });
  } else if (outcome === "not_qualified") {
    error = disqualify(d, {}, ctx);
  }
  if (error) return error;

  d.set({ last_action: callAttemptSummary(outcome), last_action_at: ctx.now });
  return null;
};

const STEPS: Record<LifecycleAction, Step> = {
  log_call_attempt: logCallAttempt,
  qualify,
  disqualify,
  clear_qualification: clearQualification,
  book_call: bookCall,
  reschedule_call: rescheduleCall,
  cancel_call: cancelBooking,
  cancel_booking: cancelBooking,
  undo_cancel_booking: undoCancelBooking,
  mark_showed: markShowed,
  mark_no_show: markNoShow,
  clear_show: clearShow,
  mark_dead: markDead,
  revive,
  set_follow_up: setFollowUp
};

export function planLifecycle(
  lead: LeadRow,
  action: LifecycleAction,
  payload: LifecyclePayload,
  actor: LifecycleActor,
  opts: { now?: string; source?: LifecycleSource } = {}
): LifecyclePlan {
  const step = STEPS[action];
  if (!step) return { ok: false, error: `Unknown action: ${action}` };
  const ctx: Ctx = { actor, now: opts.now ?? new Date().toISOString(), source: opts.source ?? "manual" };
  const draft = new Draft(lead);
  const error = step(draft, payload, ctx);
  if (error) return { ok: false, error };
  return { ok: true, patch: draft.patch, activities: draft.activities };
}
