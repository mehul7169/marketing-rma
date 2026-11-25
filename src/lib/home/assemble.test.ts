import { describe, expect, it } from "vitest";
import { makeLead } from "@/test/fixtures";
import { assembleHomeDashboard } from "@/lib/home/assemble";

const IN = "2026-11-10T06:00:00.000Z";

describe("assembleHomeDashboard", () => {
  it("hides the goal card when monthly_target is null", () => {
    const dash = assembleHomeDashboard({
      leads: [makeLead({ created_at: IN })],
      range: "30d",
      traffic: "all",
      todayISO: "2026-11-23",
      monthStart: "2026-11-01",
      monthEnd: "2026-11-30",
      monthlyTarget: null,
      setters: [],
      closerLabels: new Map(),
      ads: null
    });
    expect(dash.goal).toBeNull();
  });

  it("builds a November goal card from won deal_value", () => {
    const dash = assembleHomeDashboard({
      leads: [
        makeLead({
          id: "a",
          deal_closed: true,
          closed_at: "2026-11-05T06:00:00.000Z",
          deal_value: 525_000
        }),
        makeLead({
          id: "b",
          deal_closed: true,
          closed_at: "2026-10-05T06:00:00.000Z",
          deal_value: 100_000
        })
      ],
      range: "7d",
      traffic: "all",
      todayISO: "2026-11-23",
      monthStart: "2026-11-01",
      monthEnd: "2026-11-30",
      monthlyTarget: { metric: "revenue", value: 3_000_000 },
      setters: [],
      closerLabels: new Map(),
      ads: null
    });
    expect(dash.goal?.revenue).toBe(525_000);
    expect(dash.goal?.won).toBe(1);
    expect(dash.goal?.pace.status).toBe("behind");
    expect(dash.goal?.monthLabel).toMatch(/November/i);
  });
});
