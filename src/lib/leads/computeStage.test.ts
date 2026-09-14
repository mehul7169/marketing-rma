import { describe, expect, it } from "vitest";
import {
  computeActionStatus,
  displayActionStatus
} from "@/lib/leads/actionStatus";
import { computeLifecycleStatus } from "@/lib/leads/computeLifecycleStatus";
import { computeStage } from "@/lib/leads/computeStage";

const baseStage = {
  deal_closed: null as boolean | null,
  post_call_status: null as string | null,
  setter_verified: null as boolean | null,
  call_booked_at: null as string | null,
  requalification_result: null as string | null,
  requalification_attempted: null as boolean | null,
  call_showed: null as boolean | null,
  qualified: null as boolean | null,
  form_filled_at: null as string | null
};

describe("computeStage", () => {
  it.each([
    [{ deal_closed: true }, "closed"],
    [{ post_call_status: "dead" }, "dead_post_call"],
    [
      { setter_verified: false, call_booked_at: "2026-01-01T00:00:00.000Z" },
      "dead_unqualified_at_booking"
    ],
    [{ post_call_status: "proposal_needed" }, "proposal_needed"],
    [{ call_showed: true }, "showed"],
    [{ call_showed: false }, "no_show"],
    [{ setter_verified: true }, "verified"],
    [{ call_booked_at: "2026-01-01T00:00:00.000Z" }, "booked"],
    [{ qualified: true }, "form_qualified"],
    [{ qualified: false }, "form_unqualified"],
    [{ form_filled_at: "2026-01-01T00:00:00.000Z" }, "form_filled"],
    [{}, "lead"]
  ] as const)("%j → %s", (patch, expected) => {
    expect(computeStage({ ...baseStage, ...patch })).toBe(expected);
  });

  it("closed beats every other flag", () => {
    expect(
      computeStage({
        ...baseStage,
        deal_closed: true,
        post_call_status: "dead",
        call_showed: true,
        qualified: true
      })
    ).toBe("closed");
  });
});

describe("computeLifecycleStatus", () => {
  const base = {
    deal_closed: null as boolean | null,
    setter_verified: null as boolean | null,
    call_booked_at: null as string | null,
    post_call_status: null as string | null,
    qualified: null as boolean | null,
    requalification_attempted: null as boolean | null,
    requalification_result: null as string | null
  };

  it.each([
    [{ deal_closed: true }, "closed"],
    [
      { setter_verified: false, call_booked_at: "2026-01-01T00:00:00.000Z" },
      "dead"
    ],
    [{ post_call_status: "dead" }, "dead"],
    [{ qualified: false }, "unqualified"],
    [{ qualified: true }, "active"],
    [{}, "active"]
  ] as const)("%j → %s", (patch, expected) => {
    expect(computeLifecycleStatus({ ...base, ...patch })).toBe(expected);
  });

  it("booked unqualified is still active (not unqualified bucket)", () => {
    expect(
      computeLifecycleStatus({
        ...base,
        qualified: false,
        call_booked_at: "2026-01-01T00:00:00.000Z"
      })
    ).toBe("active");
  });
});

describe("computeActionStatus precedence", () => {
  const base = {
    deal_closed: null as boolean | null,
    is_dead: false,
    next_action_at: null as string | null,
    contact_attempts: 0,
    call_confirmed: null as boolean | null,
    call_booked_at: null as string | null,
    last_action: null as string | null
  };

  it("null action_status displays as Untouched", () => {
    expect(displayActionStatus(null)).toBe("Untouched");
    expect(displayActionStatus(undefined)).toBe("Untouched");
  });

  it("Closed beats Dead", () => {
    expect(
      computeActionStatus({ ...base, deal_closed: true, is_dead: true })
    ).toBe("Closed");
  });

  it("Dead beats Follow-up Overdue", () => {
    expect(
      computeActionStatus({
        ...base,
        is_dead: true,
        next_action_at: "2020-01-01T00:00:00.000Z"
      })
    ).toBe("Dead");
  });

  it("call_confirmed without call_booked_at → Qualified Call Booked", () => {
    // Odd combo, but precedence says confirmed wins before booked check.
    expect(
      computeActionStatus({
        ...base,
        call_confirmed: true,
        call_booked_at: null
      })
    ).toBe("Qualified Call Booked");
  });

  it("call_booked_at alone → Call Booked", () => {
    expect(
      computeActionStatus({
        ...base,
        call_booked_at: "2026-01-01T00:00:00.000Z"
      })
    ).toBe("Call Booked");
  });

  it("contact_attempts + no_answer (no next_action_at) → Personally Contacted", () => {
    // Normal no_answer sets next_action_at → Follow-up Due/Overdue; this covers
    // the fall-through when attempts > 0 without a scheduled follow-up.
    expect(
      computeActionStatus(
        { ...base, contact_attempts: 1, last_action: "Called — No Answer" },
        "no_answer"
      )
    ).toBe("Personally Contacted");
  });

  it("contact_attempts + other outcome → Personally Contacted", () => {
    expect(
      computeActionStatus(
        {
          ...base,
          contact_attempts: 1,
          last_action: "Called — Follow-up Needed"
        },
        "follow_up_needed"
      )
    ).toBe("Personally Contacted");
  });

  it("else Untouched", () => {
    expect(computeActionStatus(base)).toBe("Untouched");
  });
});
