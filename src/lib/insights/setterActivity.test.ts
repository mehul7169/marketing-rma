import { describe, expect, it } from "vitest";
import {
  computeSetterActivity,
  type SetterCallActivity
} from "@/lib/insights/setterActivity";

const A = "user-a";
const B = "user-b";

function row(
  lead_id: string,
  outcome: string,
  created_at: string,
  created_by: string | null = A
): SetterCallActivity {
  return { lead_id, outcome, created_at, created_by };
}

describe("computeSetterActivity", () => {
  const activities = [
    // Leftover rows from failed saves, then the real booking 8 min later.
    row("L1", "qualified", "2026-09-14T06:23:04.000Z"),
    row("L1", "qualified", "2026-09-14T06:23:30.000Z"),
    row("L1", "qualified", "2026-09-14T06:31:40.878Z"),
    // Qualify call on a lead who already booked on cal.com — not a booking.
    row("L2", "qualified", "2026-09-20T08:45:44.000Z", B),
    row("L3", "no_answer", "2026-09-20T09:00:00.000Z", B),
    row("L3", "no_answer", "2026-09-20T12:00:00.000Z", B),
    row("L4", "not_qualified", "2026-09-20T10:00:00.000Z"),
    row("L5", "follow_up_needed", "2026-09-20T18:45:00.000Z"), // 00:15 IST on 21 Sep
    row("L6", "not_confirmed", "2026-09-20T11:00:00.000Z", B)
  ];
  const bookedAt = new Map<string, string | null>([
    ["L1", "2026-09-14T06:31:40.786Z"],
    ["L2", "2026-09-20T05:18:57.000Z"]
  ]);
  const labels = new Map([
    [A, "a@example.com"],
    [B, "b@example.com"]
  ]);

  const report = computeSetterActivity(activities, bookedAt, labels);

  it("counts every call_attempt as a dial, repeats included", () => {
    expect(report.orgTotals.dials).toBe(9);
    expect(report.orgTotals.noAnswer).toBe(2);
    expect(report.orgTotals.unqualified).toBe(1);
    expect(report.orgTotals.followUp).toBe(1);
  });

  it("books once per lead, only when the call set call_booked_at", () => {
    expect(report.orgTotals.callsBooked).toBe(1);
    const day14 = report.daily.find((d) => d.date === "2026-09-14")!;
    expect(day14).toMatchObject({ dials: 3, callsBooked: 1 });
  });

  it("buckets by IST day", () => {
    expect(report.daily.map((d) => d.date)).toEqual(["2026-09-14", "2026-09-20", "2026-09-21"]);
    expect(report.daily.find((d) => d.date === "2026-09-21")).toMatchObject({ dials: 1, followUp: 1 });
  });

  it("breaks down per user and user totals equal org totals", () => {
    expect(report.users.map((u) => [u.label, u.dials, u.callsBooked])).toEqual([
      ["a@example.com", 5, 1],
      ["b@example.com", 4, 0]
    ]);
    expect(report.userTotals).toEqual(report.orgTotals);
  });

  it("handles an empty range", () => {
    const empty = computeSetterActivity([], new Map(), new Map());
    expect(empty.daily).toEqual([]);
    expect(empty.users).toEqual([]);
    expect(empty.orgTotals.dials).toBe(0);
  });
});
