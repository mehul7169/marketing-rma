import { describe, expect, it } from "vitest";
import {
  DEAL_ERRORS,
  formatDealStatusLine,
  planDeal,
  type DealAction,
  type DealPayload
} from "@/lib/deals/dealLifecycle";
import type { LeadRow } from "@/lib/leads/types";
import { makeLead } from "@/test/fixtures";

const NOW = "2026-11-20T10:00:00.000Z";
const FUTURE = "2026-11-22T09:30:00.000Z";
const PAST = "2026-11-19T10:00:00.000Z";
const actor = { userId: "11111111-1111-1111-1111-111111111111", email: "closer@x.com" };
const showed = { call_showed: true as const, call_showed_at: NOW, deal_closed: null };

function plan(lead: Partial<LeadRow>, action: DealAction, payload: DealPayload = {}) {
  return planDeal(makeLead(lead), action, payload, actor, { now: NOW });
}
function ok(lead: Partial<LeadRow>, action: DealAction, payload: DealPayload = {}) {
  const p = plan(lead, action, payload);
  if (!p.ok) throw new Error(`expected ok, got: ${p.error}`);
  return p;
}
const types = (p: { activities: { type: string; outcome: string | null }[] }) =>
  p.activities.map((a) => `${a.type}/${a.outcome}`);

const next = { next_step: "Call about pricing", next_action_at: FUTURE };

describe("planDeal gates", () => {
  it("rejects every action unless the lead showed", () => {
    expect(plan({}, "set_value", { value: 1 })).toEqual({
      ok: false,
      error: DEAL_ERRORS.notADeal
    });
  });

  it("ignores is_dead (pre-call flag) on open deals", () => {
    const p = ok({ ...showed, is_dead: true }, "change_stage", { stage: "awaiting_payment" });
    expect(p.patch).not.toHaveProperty("is_dead");
    expect(p.patch.post_call_status).toBe("awaiting_payment");
  });

  it("never plans pipeline_stage or is_dead writes", () => {
    const p = ok(showed, "log_follow_up", { outcome: "spoke", ...next });
    expect(p.patch).not.toHaveProperty("pipeline_stage");
    expect(p.patch).not.toHaveProperty("is_dead");
  });
});

describe("log_follow_up", () => {
  it("requires an open deal, an outcome, and a next step", () => {
    expect(plan(showed, "log_follow_up", { outcome: "spoke" })).toEqual({
      ok: false,
      error: DEAL_ERRORS.nextStepRequired
    });
    expect(plan({ ...showed, deal_closed: true }, "log_follow_up", { outcome: "spoke", ...next })).toEqual({
      ok: false,
      error: DEAL_ERRORS.notOpen
    });
  });

  it("rejects a past next_action_at unless confirmPast is set", () => {
    expect(
      plan(showed, "log_follow_up", {
        outcome: "spoke",
        next_step: "Ping",
        next_action_at: PAST
      })
    ).toEqual({ ok: false, error: DEAL_ERRORS.confirmPast });
    const p = ok(showed, "log_follow_up", {
      outcome: "spoke",
      next_step: "Ping",
      next_action_at: PAST,
      confirmPast: true
    });
    expect(p.patch.next_action_at).toBe(PAST);
  });

  it("writes next step, last_action, optional stage, and one follow-up activity", () => {
    const p = ok(showed, "log_follow_up", {
      outcome: "sent_proposal",
      note: "sent over email",
      stage: "contract_shared",
      ...next
    });
    expect(p.patch).toMatchObject({
      next_step: "Call about pricing",
      next_action_at: FUTURE,
      post_call_status: "contract_shared",
      last_action: "Follow-up: sent_proposal"
    });
    expect(p.activities).toEqual([
      {
        type: "deal_follow_up",
        outcome: "sent_proposal",
        note: "sent over email",
        next_action_at: FUTURE
      }
    ]);
  });
});

describe("set_next_step / change_stage / assign_owner / set_value", () => {
  it("set_next_step requires both fields on an open deal", () => {
    expect(plan(showed, "set_next_step", { next_step: "X" })).toEqual({
      ok: false,
      error: DEAL_ERRORS.nextStepWhen
    });
    const p = ok(showed, "set_next_step", next);
    expect(p.patch).toMatchObject(next);
    expect(types(p)).toEqual(["deal_next_step_set/null"]);
  });

  it("change_stage allows null (Showed up) and rejects proposal_needed", () => {
    expect(ok(showed, "change_stage", { stage: null }).patch.post_call_status).toBeNull();
    expect(types(ok(showed, "change_stage", { stage: "awaiting_payment" }))).toEqual([
      "deal_stage_changed/awaiting_payment"
    ]);
    expect(plan(showed, "change_stage", { stage: "proposal_needed" as never })).toEqual({
      ok: false,
      error: DEAL_ERRORS.invalidStage
    });
  });

  it("assign_owner accepts a UUID or null", () => {
    const id = "22222222-2222-2222-2222-222222222222";
    expect(ok(showed, "assign_owner", { ownerId: id }).patch.owner_id).toBe(id);
    expect(ok(showed, "assign_owner", { ownerId: null }).patch.owner_id).toBeNull();
    expect(plan(showed, "assign_owner", { ownerId: "not-a-uuid" })).toEqual({
      ok: false,
      error: DEAL_ERRORS.invalidOwner
    });
  });

  it("set_value requires a number ≥ 0", () => {
    expect(plan(showed, "set_value", { value: -1 })).toEqual({
      ok: false,
      error: DEAL_ERRORS.valueRequired
    });
    expect(ok(showed, "set_value", { value: 0 }).patch.deal_value).toBe(0);
    expect(types(ok(showed, "set_value", { value: 1500 }))).toEqual(["field_edited/null"]);
  });
});

describe("mark_won / mark_lost / reopen", () => {
  it("mark_won closes, clears the next step, and logs deal_outcome/won", () => {
    const p = ok({ ...showed, ...next, deal_value: 9 }, "mark_won", { value: 2500 });
    expect(p.patch).toMatchObject({
      deal_closed: true,
      closed_at: NOW,
      closed_by: "closer@x.com",
      deal_value: 2500,
      next_step: null,
      next_action_at: null
    });
    expect(types(p)).toEqual(["deal_outcome/won"]);
  });

  it("mark_lost requires a reason and puts it on the activity note", () => {
    expect(plan(showed, "mark_lost", {})).toEqual({
      ok: false,
      error: DEAL_ERRORS.lostReasonRequired
    });
    const p = ok(showed, "mark_lost", { lostReason: "price", note: "too steep" });
    expect(p.patch).toMatchObject({
      deal_closed: false,
      lost_reason: "price",
      next_step: null,
      next_action_at: null
    });
    expect(p.activities[0]).toMatchObject({
      type: "deal_outcome",
      outcome: "lost",
      note: "price: too steep"
    });
  });

  it("reopen needs a reason and a next step, then clears closed fields", () => {
    const closed = { ...showed, deal_closed: false as const, lost_reason: "ghosted", closed_at: NOW };
    expect(plan(closed, "reopen", { note: "they replied" })).toEqual({
      ok: false,
      error: DEAL_ERRORS.nextStepRequired
    });
    const p = ok(closed, "reopen", { note: "they replied", ...next });
    expect(p.patch).toMatchObject({
      deal_closed: null,
      lost_reason: null,
      closed_at: null,
      closed_by: null,
      next_step: "Call about pricing"
    });
    expect(types(p)).toEqual(["deal_reopened/null"]);
  });
});

describe("formatDealStatusLine", () => {
  it("renders open, won, and lost copy", () => {
    expect(
      formatDealStatusLine(
        makeLead({
          ...showed,
          post_call_status: "contract_shared",
          next_step: "Call about pricing",
          next_action_at: FUTURE
        })
      )
    ).toBe("Deal: Open · Proposal sent · Next: Call about pricing, 22 Nov 3:00 PM");
    expect(
      formatDealStatusLine(makeLead({ ...showed, deal_closed: true, closed_at: FUTURE }))
    ).toBe("Deal: Won · Closed 22 Nov");
    expect(
      formatDealStatusLine(makeLead({ ...showed, deal_closed: false, lost_reason: "price" }))
    ).toBe("Deal: Lost · Price");
    expect(formatDealStatusLine(makeLead(showed))).toBe(
      "Deal: Open · Showed up · Needs next step"
    );
  });
});
