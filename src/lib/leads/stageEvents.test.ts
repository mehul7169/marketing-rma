import { describe, expect, it } from "vitest";
import { makeLead } from "@/test/fixtures";
import {
  leadReachedCohortStage,
  type FunnelEventStage
} from "@/lib/leads/stageEvents";

const STEPS: FunnelEventStage[] = [
  "created",
  "call_booked",
  "qualified_call_booked",
  "show_up",
  "closed"
];

describe("leadReachedCohortStage", () => {
  it("uses persistent fields, not current stage", () => {
    const closed = makeLead({
      stage: "closed",
      call_booked_at: "2026-01-01T00:00:00.000Z",
      call_confirmed: true,
      call_showed: true,
      deal_closed: true
    });
    expect(leadReachedCohortStage(closed, "call_booked")).toBe(true);
    expect(leadReachedCohortStage(closed, "qualified_call_booked")).toBe(true);
    expect(leadReachedCohortStage(closed, "show_up")).toBe(true);
    expect(leadReachedCohortStage(closed, "closed")).toBe(true);
  });

  it("qualified_call_booked counts call_confirmed only (not stage)", () => {
    const advanced = makeLead({
      stage: "show_up",
      call_confirmed: true,
      call_showed: true
    });
    const onlyStage = makeLead({
      stage: "qualified_call_booked",
      call_confirmed: null
    });
    expect(leadReachedCohortStage(advanced, "qualified_call_booked")).toBe(true);
    expect(leadReachedCohortStage(onlyStage, "qualified_call_booked")).toBe(false);
  });

  it("funnel counts are monotonically non-increasing for a progressed lead", () => {
    const lead = makeLead({
      call_booked_at: "2026-01-01T00:00:00.000Z",
      call_confirmed: true,
      call_showed: true,
      deal_closed: true,
      stage: "closed"
    });
    const reached = STEPS.map((s) => leadReachedCohortStage(lead, s));
    expect(reached).toEqual([true, true, true, true, true]);
  });
});
