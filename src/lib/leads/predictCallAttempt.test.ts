import { describe, expect, it } from "vitest";
import { makeLead } from "@/test/fixtures";
import { predictLogCallAttemptPatch } from "@/lib/leads/predictCallAttempt";

describe("predictLogCallAttemptPatch", () => {
  it("no_answer increments attempts and schedules next touchpoint", () => {
    const lead = makeLead({ contact_attempts: 0 });
    const patch = predictLogCallAttemptPatch(lead, "no_answer")!;
    expect(patch.contact_attempts).toBe(1);
    expect(patch.is_dead).toBe(false);
    expect(patch.next_action_at).toBeTruthy();
    expect(patch).not.toHaveProperty("action_status");
    expect(patch.first_contacted_at).toBeTruthy();
  });

  it("no_answer at 3 marks dead", () => {
    const lead = makeLead({ contact_attempts: 2 });
    const patch = predictLogCallAttemptPatch(lead, "no_answer")!;
    expect(patch.contact_attempts).toBe(3);
    expect(patch.is_dead).toBe(true);
    expect(patch.dead_reason).toBe("no_answer");
    expect(patch.next_action_at).toBeNull();
  });

  it("qualified books + confirms and resets attempts", () => {
    const lead = makeLead({ contact_attempts: 2, call_booked_at: null });
    const when = "2026-06-01T10:00:00.000Z";
    const patch = predictLogCallAttemptPatch(lead, "qualified", {
      scheduledForIso: when
    })!;
    expect(patch).not.toHaveProperty("call_confirmed");
    expect(patch.call_scheduled_for).toBe(when);
    expect(patch.call_booked_at).toBeTruthy();
    expect(patch.contact_attempts).toBe(0);
    expect(patch.qualified).toBe(true);
  });

  it("returns null when the server would reject (follow-up without a date)", () => {
    expect(predictLogCallAttemptPatch(makeLead(), "follow_up_needed")).toBeNull();
  });
});
