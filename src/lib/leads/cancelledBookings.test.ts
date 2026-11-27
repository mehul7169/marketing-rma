import { describe, expect, it } from "vitest";
import {
  formatCancelledBreakdown,
  summarizeCancelledBookings
} from "@/lib/leads/cancelledBookings";

const FROM = "2026-11-01";
const TO = "2026-11-30";

describe("summarizeCancelledBookings", () => {
  it("counts call_cancelled in range and skips logged_by_mistake", () => {
    const stat = summarizeCancelledBookings(
      [
        {
          type: "call_cancelled",
          outcome: "not_qualified",
          created_at: "2026-11-10T06:00:00.000Z"
        },
        {
          type: "call_cancelled",
          outcome: "not_qualified",
          created_at: "2026-11-11T06:00:00.000Z"
        },
        {
          type: "call_cancelled",
          outcome: "unreachable",
          created_at: "2026-11-12T06:00:00.000Z"
        },
        {
          type: "call_cancelled",
          outcome: "logged_by_mistake",
          created_at: "2026-11-13T06:00:00.000Z"
        },
        {
          type: "call_attempt",
          outcome: "not_qualified",
          created_at: "2026-11-10T06:00:00.000Z"
        },
        {
          type: "call_cancelled",
          outcome: "duplicate_booking",
          created_at: "2026-10-01T06:00:00.000Z"
        }
      ],
      FROM,
      TO
    );
    expect(stat.total).toBe(3);
    expect(stat.byReason).toEqual({ not_qualified: 2, unreachable: 1 });
    expect(formatCancelledBreakdown(stat)).toBe("Not qualified 2 · Unreachable 1");
  });
});
