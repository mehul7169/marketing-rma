import { describe, expect, it } from "vitest";
import {
  computeActionStatus,
  nextTouchpointAt
} from "@/lib/leads/actionStatus";
import { todayISTDateString, zonedTimeToUtc, IST_TIMEZONE } from "@/lib/timezone";

describe("computeActionStatus follow-up branches", () => {
  const base = {
    deal_closed: null as boolean | null,
    is_dead: false,
    next_action_at: null as string | null,
    contact_attempts: 0,
    call_confirmed: null as boolean | null,
    call_booked_at: null as string | null,
    last_action: null as string | null
  };

  it("Follow-up Overdue when next_action_at is before today IST", () => {
    expect(
      computeActionStatus({
        ...base,
        next_action_at: "2020-01-01T00:00:00.000Z"
      })
    ).toBe("Follow-up Overdue");
  });

  it("Follow-up Due when next_action_at is today IST", () => {
    const today = todayISTDateString(); // YYYY-MM-DD
    const [y, m, d] = today.split("-").map(Number);
    const noonIst = zonedTimeToUtc(
      `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00`,
      IST_TIMEZONE
    ).toISOString();

    expect(
      computeActionStatus({
        ...base,
        next_action_at: noonIst
      })
    ).toBe("Follow-up Due");
  });

  it("future next_action_at falls through to Untouched when no attempts", () => {
    expect(
      computeActionStatus({
        ...base,
        next_action_at: "2099-01-01T00:00:00.000Z"
      })
    ).toBe("Untouched");
  });
});

describe("nextTouchpointAt", () => {
  it("returns an ISO string after the given time", () => {
    const from = new Date("2026-03-15T03:00:00.000Z"); // morning IST
    const next = nextTouchpointAt(from);
    expect(new Date(next).getTime()).toBeGreaterThan(from.getTime());
  });
});
