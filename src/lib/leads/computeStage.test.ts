import { describe, expect, it } from "vitest";
import {
  computeActionStatus,
  displayActionStatus
} from "@/lib/leads/actionStatus";
import { computeLifecycleStatus } from "@/lib/leads/computeLifecycleStatus";
import { computeStage, LEAD_STAGES } from "@/lib/leads/computeStage";

const baseStage = {
  deal_closed: null as boolean | null,
  is_dead: false,
  post_call_status: null as string | null,
  call_showed: null as boolean | null,
  call_confirmed: null as boolean | null,
  call_booked_at: null as string | null
};

describe("computeStage", () => {
  it("exposes exactly the redesigned stage set", () => {
    expect(LEAD_STAGES).toEqual([
      "created",
      "call_booked",
      "qualified_call_booked",
      "show_up",
      "follow_up_call_booked",
      "awaiting_lead_response",
      "proposal_needed",
      "contract_shared",
      "awaiting_payment",
      "dead",
      "closed"
    ]);
  });

  it.each([
    [{ deal_closed: true }, "closed"],
    [{ is_dead: true }, "dead"],
    [{ post_call_status: "proposal_needed" }, "proposal_needed"],
    [{ call_showed: true }, "show_up"],
    [
      {
        call_confirmed: true,
        call_booked_at: "2026-01-01T00:00:00.000Z"
      },
      "qualified_call_booked"
    ],
    [{ call_booked_at: "2026-01-01T00:00:00.000Z" }, "call_booked"],
    [{}, "created"]
  ] as const)("%j → %s", (patch, expected) => {
    expect(computeStage({ ...baseStage, ...patch })).toBe(expected);
  });

  it("closed beats dead and every other flag", () => {
    expect(
      computeStage({
        ...baseStage,
        deal_closed: true,
        is_dead: true,
        call_showed: true,
        call_confirmed: true,
        call_booked_at: "2026-01-01T00:00:00.000Z"
      })
    ).toBe("closed");
  });

  it("is_dead beats post-call and booking flags", () => {
    expect(
      computeStage({
        ...baseStage,
        is_dead: true,
        post_call_status: "proposal_needed",
        call_booked_at: "2026-01-01T00:00:00.000Z"
      })
    ).toBe("dead");
  });

  it("ignores legacy post_call_status dead sentinel (use is_dead)", () => {
    expect(
      computeStage({
        ...baseStage,
        post_call_status: "dead",
        call_booked_at: "2026-01-01T00:00:00.000Z"
      })
    ).toBe("call_booked");
  });

  it("call_confirmed without call_booked_at does not qualify as booked", () => {
    expect(
      computeStage({
        ...baseStage,
        call_confirmed: true,
        call_booked_at: null
      })
    ).toBe("created");
  });
});

describe("computeLifecycleStatus", () => {
  const base = {
    deal_closed: null as boolean | null,
    is_dead: false,
    call_booked_at: null as string | null,
    qualified: null as boolean | null
  };

  it.each([
    [{ deal_closed: true }, "closed"],
    [{ is_dead: true }, "dead"],
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

  it("legacy dead signals without is_dead are not enough", () => {
    expect(
      computeLifecycleStatus({
        ...base,
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
