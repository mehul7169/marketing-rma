import { describe, expect, it } from "vitest";
import { makeLead } from "@/test/fixtures";
import { predictLogCallAttemptPatch } from "@/lib/leads/predictCallAttempt";

describe("predictLogCallAttemptPatch", () => {
  it("no_answer increments attempts and schedules next touchpoint", () => {
    const lead = makeLead({ contact_attempts: 0, action_status: null });
    const patch = predictLogCallAttemptPatch(lead, "no_answer");
    expect(patch.contact_attempts).toBe(1);
    expect(patch.is_dead).toBe(false);
    expect(patch.next_action_at).toBeTruthy();
    expect(patch.action_status).toBeTruthy();
  });

  it("no_answer at 3 marks dead", () => {
    const lead = makeLead({ contact_attempts: 2 });
    const patch = predictLogCallAttemptPatch(lead, "no_answer");
    expect(patch.contact_attempts).toBe(3);
    expect(patch.is_dead).toBe(true);
    expect(patch.next_action_at).toBeNull();
  });

  it("qualified books + confirms and resets attempts", () => {
    const lead = makeLead({ contact_attempts: 2, call_booked_at: null });
    const when = "2026-06-01T10:00:00.000Z";
    const patch = predictLogCallAttemptPatch(lead, "qualified", {
      scheduledForIso: when
    });
    expect(patch.call_confirmed).toBe(true);
    expect(patch.call_scheduled_for).toBe(when);
    expect(patch.call_booked_at).toBeTruthy();
    expect(patch.contact_attempts).toBe(0);
    expect(patch.qualified).toBe(true);
  });
});
