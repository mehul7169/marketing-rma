import { describe, expect, it } from "vitest";
import { makeLead } from "@/test/fixtures";
import {
  LIFECYCLE_ERRORS,
  planLifecycle,
  type LifecycleAction,
  type LifecyclePayload
} from "@/lib/leads/lifecycle";
import type { LeadRow } from "@/lib/leads/types";

const NOW = "2026-10-27T10:00:00.000Z";
const actor = { userId: "u1", email: "setter@x.com" };
const contacted = { first_contacted_at: "2026-10-20T10:00:00.000Z" };
const booked = { ...contacted, call_booked_at: "2026-10-21T10:00:00.000Z", call_scheduled_for: "2026-10-25T10:00:00.000Z" };

function plan(lead: Partial<LeadRow>, action: LifecycleAction, payload: LifecyclePayload = {}, source?: "manual" | "cal_com" | "quickform") {
  return planLifecycle(makeLead(lead), action, payload, actor, { now: NOW, source });
}
function ok(lead: Partial<LeadRow>, action: LifecycleAction, payload: LifecyclePayload = {}, source?: "manual" | "cal_com" | "quickform") {
  const p = plan(lead, action, payload, source);
  if (!p.ok) throw new Error(`expected ok, got: ${p.error}`);
  return p;
}
const types = (p: { activities: { type: string; outcome: string | null }[] }) =>
  p.activities.map((a) => `${a.type}/${a.outcome}`);

describe("log_call_attempt", () => {
  it("sets first_contacted_at once and keeps the cadence counter", () => {
    const p = ok({ contact_attempts: 0 }, "log_call_attempt", { outcome: "no_answer" });
    expect(p.patch).toMatchObject({ contact_attempts: 1, first_contacted_at: NOW, is_dead: false });
    expect(p.patch.next_action_at).toBeTruthy();
    expect(types(p)).toEqual(["call_attempt/no_answer"]);

    const again = ok({ ...contacted, contact_attempts: 1 }, "log_call_attempt", { outcome: "no_answer" });
    expect(again.patch.first_contacted_at).toBe(contacted.first_contacted_at);
  });

  it("3rd no-answer marks dead with the no_answer code", () => {
    const p = ok({ contact_attempts: 2 }, "log_call_attempt", { outcome: "no_answer" });
    expect(p.patch).toMatchObject({ is_dead: true, dead_reason: "no_answer", next_action_at: null });
  });

  it("follow_up_needed requires a date", () => {
    expect(plan({}, "log_call_attempt", { outcome: "follow_up_needed" })).toEqual({
      ok: false,
      error: LIFECYCLE_ERRORS.followUpRequired
    });
    const p = ok({}, "log_call_attempt", { outcome: "follow_up_needed", followUpAt: "2026-10-28T05:00:00.000Z" });
    expect(p.patch.next_action_at).toBe("2026-10-28T05:00:00.000Z");
  });

  it("qualified = qualify + book_call on an uncontacted lead, in one plan", () => {
    const p = ok({ contact_attempts: 2 }, "log_call_attempt", {
      outcome: "qualified",
      scheduledFor: "2026-10-29T10:00:00.000Z"
    });
    expect(p.patch).toMatchObject({
      first_contacted_at: NOW,
      qualified: true,
      qualified_at: NOW,
      qualified_by: "setter@x.com",
      call_booked_at: NOW,
      call_scheduled_for: "2026-10-29T10:00:00.000Z",
      call_confirmed: true,
      contact_attempts: 0,
      last_action: "Called — Qualified"
    });
    expect(types(p)).toEqual(["call_attempt/qualified", "qualification/qualified", "schedule/null"]);
  });

  it("qualified on an already-booked lead keeps call_booked_at and logs no schedule", () => {
    const p = ok(booked, "log_call_attempt", { outcome: "qualified" });
    expect(p.patch).not.toHaveProperty("call_booked_at");
    expect(types(p)).toEqual(["call_attempt/qualified", "qualification/qualified"]);
  });

  it("qualified requires a call time when not booked", () => {
    expect(plan({}, "log_call_attempt", { outcome: "qualified" })).toMatchObject({ ok: false });
  });

  it("not_qualified runs disqualify (dead, not_qualified)", () => {
    const p = ok({}, "log_call_attempt", { outcome: "not_qualified" });
    expect(p.patch).toMatchObject({ qualified: false, is_dead: true, dead_reason: "not_qualified", qualified_by: "setter@x.com" });
    expect(types(p)).toEqual(["call_attempt/not_qualified", "qualification/unqualified"]);
  });

  it("rejects reserved / unknown outcomes", () => {
    expect(plan({}, "log_call_attempt", { outcome: "confirmed" as never })).toMatchObject({ ok: false });
  });
});

describe("qualification", () => {
  it("qualify sets now + actor and refuses dead leads", () => {
    expect(ok({}, "qualify").patch).toMatchObject({ qualified: true, qualified_at: NOW, qualified_by: "setter@x.com" });
    expect(plan({ is_dead: true }, "qualify")).toEqual({ ok: false, error: LIFECYCLE_ERRORS.qualifyDead });
  });

  it("disqualify marks dead with not_qualified", () => {
    const p = ok({}, "disqualify");
    expect(p.patch).toMatchObject({ qualified: false, qualified_at: NOW, is_dead: true, dead_reason: "not_qualified" });
    expect(types(p)).toEqual(["qualification/unqualified"]);
  });

  it("clear_qualification needs a reason and nulls all three fields", () => {
    expect(plan({ qualified: true }, "clear_qualification")).toEqual({ ok: false, error: LIFECYCLE_ERRORS.reasonRequired });
    const p = ok({ qualified: true }, "clear_qualification", { reason: "misclick" });
    expect(p.patch).toMatchObject({ qualified: null, qualified_at: null, qualified_by: null });
    expect(p.activities[0]).toMatchObject({ type: "qualification", outcome: "cleared", note: "misclick" });
  });
});

describe("booking", () => {
  const when = { scheduledFor: "2026-10-29T10:00:00.000Z" };

  it("book_call is hard-blocked on an uncontacted lead", () => {
    expect(plan({}, "book_call", when)).toEqual({ ok: false, error: LIFECYCLE_ERRORS.bookBeforeContact });
  });

  it("ingestion sources skip the contacted gate", () => {
    const p = ok({}, "book_call", { ...when, calComBookingId: "cal-1" }, "cal_com");
    expect(p.patch).toMatchObject({ call_booked_at: NOW, booking_source: "cal_com", cal_com_booking_id: "cal-1" });
    expect(types(p)).toEqual(["schedule/null"]);
    expect(ok({}, "book_call", when, "quickform").patch.call_booked_at).toBe(NOW);
  });

  it("manual book_call appends booking_history and refuses an already-booked lead", () => {
    const p = ok(contacted, "book_call", when);
    expect(p.patch.booking_history).toHaveLength(1);
    expect(p.patch.booking_source).toBe("manual");
    expect(plan(booked, "book_call", when)).toEqual({ ok: false, error: LIFECYCLE_ERRORS.alreadyBooked });
  });

  it("reschedule_call keeps call_booked_at, appends history, clears show fields", () => {
    const p = ok({ ...booked, call_showed: false, is_dead: true, dead_reason: "no_show" }, "reschedule_call", when);
    expect(p.patch).not.toHaveProperty("call_booked_at");
    expect(p.patch).toMatchObject({ call_scheduled_for: when.scheduledFor, call_showed: null, call_showed_at: null, is_dead: false });
    expect(p.patch.booking_history?.[0]).toMatchObject({ previous_scheduled_for: booked.call_scheduled_for });
    expect(plan(contacted, "reschedule_call", when)).toEqual({ ok: false, error: LIFECYCLE_ERRORS.notBooked });
  });

  it("cancel_call needs a booking and a reason", () => {
    expect(plan(contacted, "cancel_call", { reason: "x" })).toMatchObject({ ok: false });
    expect(plan(booked, "cancel_call")).toEqual({ ok: false, error: LIFECYCLE_ERRORS.reasonRequired });
    const p = ok(booked, "cancel_call", { reason: "lead asked" });
    expect(p.patch).toMatchObject({ call_booked_at: null, call_scheduled_for: null });
    expect(p.activities[0]).toMatchObject({ type: "call_cancelled", note: "lead asked" });
    expect(plan({ ...booked, call_showed: true }, "cancel_call", { reason: "x" })).toEqual({
      ok: false,
      error: LIFECYCLE_ERRORS.cancelAfterShow
    });
  });
});

describe("show outcome", () => {
  it("mark_showed is hard-blocked without a booking", () => {
    expect(plan(contacted, "mark_showed")).toEqual({ ok: false, error: LIFECYCLE_ERRORS.showedNeedsBooking });
  });

  it("mark_showed sets call_showed_at once", () => {
    expect(ok(booked, "mark_showed").patch).toMatchObject({ call_showed: true, call_showed_at: NOW });
    const earlier = "2026-10-25T11:00:00.000Z";
    expect(ok({ ...booked, call_showed_at: earlier }, "mark_showed").patch.call_showed_at).toBe(earlier);
  });

  it("mark_no_show never sets call_showed_at and marks dead", () => {
    const p = ok({ ...booked, call_showed_at: "2026-10-25T11:00:00.000Z" }, "mark_no_show");
    expect(p.patch).toMatchObject({ call_showed: false, call_showed_at: null, is_dead: true, dead_reason: "no_show" });
    expect(types(p)).toEqual(["show_outcome/no_show"]);
  });

  it("clear_show needs a reason", () => {
    expect(plan(booked, "clear_show")).toMatchObject({ ok: false });
    expect(ok({ ...booked, call_showed: true }, "clear_show", { reason: "wrong lead" }).patch).toMatchObject({
      call_showed: null,
      call_showed_at: null
    });
  });
});

describe("dead / revive / follow-up", () => {
  it("mark_dead stores the code and logs it", () => {
    const p = ok(booked, "mark_dead", { deadReason: "not_interested" });
    expect(p.patch).toMatchObject({ is_dead: true, dead_reason: "not_interested" });
    expect(types(p)).toEqual(["marked_dead/not_interested"]);
    expect(plan({ is_dead: true }, "mark_dead")).toMatchObject({ ok: false });
  });

  it("revive resets cadence and clears qualification only for not_qualified", () => {
    const p = ok({ is_dead: true, dead_reason: "not_qualified", qualified: false, contact_attempts: 3 }, "revive");
    expect(p.patch).toMatchObject({ is_dead: false, dead_reason: null, contact_attempts: 0, action_status: "Untouched", qualified: null, qualified_at: null, qualified_by: null });
    const legacy = ok({ is_dead: true, dead_reason: "reached lead, confirmed not qualified", qualified: false }, "revive");
    expect(legacy.patch.qualified).toBeNull();
    const noAnswer = ok({ is_dead: true, dead_reason: "no_answer", qualified: true }, "revive");
    expect(noAnswer.patch).not.toHaveProperty("qualified");
    expect(plan({}, "revive")).toEqual({ ok: false, error: LIFECYCLE_ERRORS.notDead });
  });

  it("set_follow_up writes next_action_at and logs it on the activity", () => {
    const at = "2026-10-30T05:00:00.000Z";
    const p = ok({}, "set_follow_up", { followUpAt: at });
    expect(p.patch.next_action_at).toBe(at);
    expect(p.activities[0]).toMatchObject({ type: "follow_up_set", next_action_at: at });
    expect(plan({}, "set_follow_up")).toMatchObject({ ok: false });
  });
});

it("never plans a write to pipeline_stage or setter_verified", () => {
  const all: Array<[Partial<LeadRow>, LifecycleAction, LifecyclePayload]> = [
    [{}, "log_call_attempt", { outcome: "qualified", scheduledFor: NOW }],
    [booked, "mark_showed", {}],
    [{ is_dead: true }, "revive", {}]
  ];
  for (const [lead, action, payload] of all) {
    const p = ok(lead, action, payload);
    expect(p.patch).not.toHaveProperty("pipeline_stage");
    expect(p.patch).not.toHaveProperty("setter_verified");
  }
});
