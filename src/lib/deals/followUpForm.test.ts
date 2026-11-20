import { describe, expect, it } from "vitest";
import { DEAL_ERRORS } from "@/lib/deals/dealLifecycle";
import { emptyFollowUpForm, validateFollowUpForm } from "@/lib/deals/followUpForm";

const now = new Date("2026-11-20T10:00:00.000Z");

describe("validateFollowUpForm", () => {
  it("requires an outcome, next step, and time for Save", () => {
    const base = emptyFollowUpForm(now);
    expect(validateFollowUpForm(base, now)).toEqual({
      ok: false,
      error: DEAL_ERRORS.invalidOutcome
    });
    expect(
      validateFollowUpForm({ ...base, outcome: "spoke" }, now)
    ).toEqual({ ok: false, error: DEAL_ERRORS.nextStepRequired });
    expect(
      validateFollowUpForm({ ...base, outcome: "spoke", nextStep: "Call" }, now)
    ).toEqual({ ok: false, error: DEAL_ERRORS.nextStepWhen });
    expect(
      validateFollowUpForm(
        { ...base, outcome: "spoke", whenLocal: "2026-11-21T11:00" },
        now
      )
    ).toEqual({ ok: false, error: DEAL_ERRORS.nextStepWhat });
  });

  it("asks for confirmation when the next step is in the past", () => {
    const base = emptyFollowUpForm(now);
    const past = validateFollowUpForm(
      {
        ...base,
        outcome: "spoke",
        nextStep: "Call",
        whenLocal: "2026-11-20T12:00",
        confirmPast: false
      },
      now
    );
    expect(past).toEqual({ ok: false, error: DEAL_ERRORS.confirmPast });
    const ok = validateFollowUpForm(
      {
        ...base,
        outcome: "spoke",
        nextStep: "Call",
        whenLocal: "2026-11-20T12:00",
        confirmPast: true
      },
      now
    );
    expect(ok.ok).toBe(true);
  });

  it("requires a lost reason and does not require a next step", () => {
    const base = { ...emptyFollowUpForm(now), mode: "lost" as const };
    expect(validateFollowUpForm(base, now)).toEqual({
      ok: false,
      error: DEAL_ERRORS.lostReasonRequired
    });
    const ok = validateFollowUpForm({ ...base, lostReason: "price" }, now);
    expect(ok).toEqual({
      ok: true,
      action: "mark_lost",
      payload: { lostReason: "price", note: null }
    });
  });

  it("mark won does not require a next step", () => {
    const res = validateFollowUpForm(
      { ...emptyFollowUpForm(now), mode: "won", value: "2500" },
      now
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.action).toBe("mark_won");
      expect(res.payload.value).toBe(2500);
    }
  });
});
