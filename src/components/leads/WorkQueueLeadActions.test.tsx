import { describe, expect, it } from "vitest";
import { primaryWorkQueueActions } from "@/components/leads/WorkQueueLeadActions";
import { makeLead } from "@/test/fixtures";

const BOOKED = "2026-01-01T00:00:00.000Z";

describe("primaryWorkQueueActions", () => {
  it("New → Log Call only", () => {
    expect(primaryWorkQueueActions(makeLead())).toEqual(["log_call"]);
  });

  it("Contacted / Qualified (not booked) → Log Call", () => {
    expect(
      primaryWorkQueueActions(
        makeLead({ first_contacted_at: BOOKED, contact_attempts: 1 })
      )
    ).toEqual(["log_call"]);
    expect(
      primaryWorkQueueActions(makeLead({ qualified: true, qualified_at: BOOKED }))
    ).toEqual(["log_call"]);
  });

  it("follow-up set on a contacted lead → Log Call", () => {
    expect(
      primaryWorkQueueActions(
        makeLead({ first_contacted_at: BOOKED, next_action_at: "2020-01-01T00:00:00.000Z" })
      )
    ).toEqual(["log_call"]);
  });

  it("Call Booked, needs qualification → Qualify Call", () => {
    expect(
      primaryWorkQueueActions(makeLead({ call_booked_at: BOOKED, qualified: null }))
    ).toEqual(["qualify"]);
  });

  it("Call Booked and already qualified (not past due) → no primary actions", () => {
    expect(
      primaryWorkQueueActions(
        makeLead({ call_booked_at: BOOKED, qualified: true, call_scheduled_for: null })
      )
    ).toEqual([]);
  });

  it("past-due scheduled call → Log Outcome (show)", () => {
    expect(
      primaryWorkQueueActions(
        makeLead({
          call_booked_at: BOOKED,
          qualified: true,
          call_scheduled_for: "2020-01-01T00:00:00.000Z",
          call_showed: null
        })
      )
    ).toEqual(["show"]);
  });

  it("no-show → Reschedule", () => {
    expect(
      primaryWorkQueueActions(makeLead({ call_booked_at: BOOKED, call_showed: false }))
    ).toEqual(["reschedule"]);
  });

  it("Dead / Showed Up → no primary actions", () => {
    expect(primaryWorkQueueActions(makeLead({ is_dead: true }))).toEqual([]);
    expect(
      primaryWorkQueueActions(
        makeLead({ call_booked_at: BOOKED, call_showed: true, deal_closed: true })
      )
    ).toEqual([]);
  });
});
