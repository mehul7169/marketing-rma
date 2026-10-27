import { describe, expect, it } from "vitest";
import { computeStage, LEAD_STAGES } from "@/lib/leads/computeStage";

const base = {
  deal_closed: null as boolean | null,
  is_dead: false,
  post_call_status: null as string | null,
  call_showed: null as boolean | null,
  qualified: null as boolean | null,
  call_booked_at: null as string | null
};

describe("computeStage (legacy lead.stage, still written by stamp)", () => {
  it("exposes the post-call stage set", () => {
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
        qualified: true,
        call_booked_at: "2026-01-01T00:00:00.000Z"
      },
      "qualified_call_booked"
    ],
    [{ call_booked_at: "2026-01-01T00:00:00.000Z" }, "call_booked"],
    [{}, "created"]
  ] as const)("%j → %s", (patch, expected) => {
    expect(computeStage({ ...base, ...patch })).toBe(expected);
  });

  it("closed beats dead and every other flag", () => {
    expect(
      computeStage({
        ...base,
        deal_closed: true,
        is_dead: true,
        call_showed: true,
        qualified: true,
        call_booked_at: "2026-01-01T00:00:00.000Z"
      })
    ).toBe("closed");
  });

  it("qualified without a booking stays created (pipeline_stage handles pre-call)", () => {
    expect(computeStage({ ...base, qualified: true })).toBe("created");
  });
});
