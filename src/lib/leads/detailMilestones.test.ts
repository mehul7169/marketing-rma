import { describe, expect, it } from "vitest";
import { makeLead } from "@/test/fixtures";
import { detailMilestones } from "@/lib/leads/detailMilestones";

describe("detailMilestones", () => {
  it("returns one entry per changed milestone in funnel order", () => {
    const lead = makeLead();
    const out = detailMilestones(lead, { call_showed: true, deal_closed: true });
    expect(out.map((m) => m.summary)).toEqual(["Call showed", "Deal won"]);
    expect(out[0]).toMatchObject({ type: "show_outcome", outcome: "showed" });
  });

  it("labels negative outcomes", () => {
    const out = detailMilestones(makeLead(), {
      qualified: false,
      setter_verified: false,
      call_showed: false,
      deal_closed: false
    });
    expect(out.map((m) => m.summary)).toEqual([
      "Marked Unqualified",
      "Setter marked Unqualified",
      "Call no-show",
      "Deal lost"
    ]);
  });

  it("ignores unchanged values, clears to null, and non-milestone fields", () => {
    const lead = makeLead({ qualified: true, deal_closed: true });
    expect(detailMilestones(lead, { qualified: true })).toEqual([]);
    expect(detailMilestones(lead, { deal_closed: null })).toEqual([]);
    expect(detailMilestones(lead, {})).toEqual([]);
  });
});
