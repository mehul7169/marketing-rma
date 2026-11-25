import { describe, expect, it } from "vitest";
import { revenuePace } from "@/lib/home/pace";

const GOAL = 3_000_000;

describe("revenuePace", () => {
  it("is behind when under linear pace mid-month", () => {
    const p = revenuePace({
      revenue: 525_000,
      goal: GOAL,
      todayISO: "2026-11-23",
      monthStart: "2026-11-01",
      monthEnd: "2026-11-30"
    });
    expect(p.daysInMonth).toBe(30);
    expect(p.daysElapsed).toBe(23);
    expect(p.daysLeft).toBe(8);
    expect(p.remaining).toBe(2_475_000);
    expect(p.status).toBe("behind");
    expect(p.expected).toBeCloseTo(GOAL * (23 / 30));
  });

  it("is ahead when above linear pace", () => {
    const p = revenuePace({
      revenue: 2_500_000,
      goal: GOAL,
      todayISO: "2026-11-10",
      monthStart: "2026-11-01",
      monthEnd: "2026-11-30"
    });
    expect(p.status).toBe("ahead");
  });

  it("counts the first day as 1 elapsed and a full month left", () => {
    const p = revenuePace({
      revenue: 0,
      goal: GOAL,
      todayISO: "2026-11-01",
      monthStart: "2026-11-01",
      monthEnd: "2026-11-30"
    });
    expect(p.daysElapsed).toBe(1);
    expect(p.daysLeft).toBe(30);
    expect(p.status).toBe("behind");
  });

  it("has one day left on the last day of the month", () => {
    const p = revenuePace({
      revenue: 1_000_000,
      goal: GOAL,
      todayISO: "2026-11-30",
      monthStart: "2026-11-01",
      monthEnd: "2026-11-30"
    });
    expect(p.daysElapsed).toBe(30);
    expect(p.daysLeft).toBe(1);
    expect(p.status).toBe("behind");
  });

  it("is ahead with zero remaining when the goal is already exceeded", () => {
    const p = revenuePace({
      revenue: 3_500_000,
      goal: GOAL,
      todayISO: "2026-11-10",
      monthStart: "2026-11-01",
      monthEnd: "2026-11-30"
    });
    expect(p.status).toBe("ahead");
    expect(p.remaining).toBe(0);
    expect(p.perDay).toBe(0);
  });
});
