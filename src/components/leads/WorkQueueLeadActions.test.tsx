import { describe, expect, it } from "vitest";
import { primaryWorkQueueActions } from "@/components/leads/WorkQueueLeadActions";
import { makeLead } from "@/test/fixtures";

describe("primaryWorkQueueActions", () => {
  it("Untouched → Log Call only", () => {
    expect(
      primaryWorkQueueActions(
        makeLead({ action_status: null, call_booked_at: null })
      )
    ).toEqual(["log_call"]);
  });

  it("Personally Contacted → Log Call", () => {
    expect(
      primaryWorkQueueActions(
        makeLead({
          action_status: "Personally Contacted",
          contact_attempts: 1
        })
      )
    ).toEqual(["log_call"]);
  });

  it("Follow-up Due / Overdue → Log Call", () => {
    expect(
      primaryWorkQueueActions(makeLead({ action_status: "Follow-up Due" }))
    ).toEqual(["log_call"]);
    expect(
      primaryWorkQueueActions(makeLead({ action_status: "Follow-up Overdue" }))
    ).toEqual(["log_call"]);
  });

  it("Call Booked (unconfirmed) → Qualify Call", () => {
    expect(
      primaryWorkQueueActions(
        makeLead({
          action_status: "Call Booked",
          call_booked_at: "2026-01-01T00:00:00.000Z",
          call_confirmed: null
        })
      )
    ).toEqual(["qualify"]);
  });

  it("past-due scheduled call → Log Outcome (show)", () => {
    expect(
      primaryWorkQueueActions(
        makeLead({
          action_status: "Qualified Call Booked",
          call_booked_at: "2026-01-01T00:00:00.000Z",
          call_confirmed: true,
          call_scheduled_for: "2020-01-01T00:00:00.000Z",
          call_showed: null
        })
      )
    ).toEqual(["show"]);
  });

  it("no-show → Reschedule", () => {
    expect(
      primaryWorkQueueActions(
        makeLead({
          action_status: "Personally Contacted",
          call_showed: false
        })
      )
    ).toEqual(["reschedule"]);
  });

  it("Closed / Dead / Qualified Call Booked (not past due) → no primary actions", () => {
    expect(
      primaryWorkQueueActions(
        makeLead({ action_status: "Closed", deal_closed: true })
      )
    ).toEqual([]);
    expect(
      primaryWorkQueueActions(makeLead({ action_status: "Dead", is_dead: true }))
    ).toEqual([]);
    expect(
      primaryWorkQueueActions(
        makeLead({
          action_status: "Qualified Call Booked",
          call_confirmed: true,
          call_booked_at: "2026-01-01T00:00:00.000Z",
          call_scheduled_for: null
        })
      )
    ).toEqual([]);
  });

  it("never returns more than 2 actions", () => {
    const actions = primaryWorkQueueActions(
      makeLead({
        action_status: "Untouched",
        call_showed: false
      })
    );
    expect(actions.length).toBeLessThanOrEqual(2);
    // no-show branch wins → only reschedule
    expect(actions).toEqual(["reschedule"]);
  });
});
