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

  it("puts cancelled bookings on the Calls Booked KPI sub line", () => {
    const dash = assembleHomeDashboard({
      leads: [
        makeLead({
          id: "booked",
          created_at: IN,
          call_booked_at: IN
        })
      ],
      range: "30d",
      traffic: "all",
      todayISO: "2026-11-23",
      monthStart: "2026-11-01",
      monthEnd: "2026-11-30",
      monthlyTarget: null,
      setters: [],
      closerLabels: new Map(),
      ads: null,
      cancelledBookings: { total: 3, byReason: { not_qualified: 2, unreachable: 1 } }
    });
    const booked = dash.kpis.find((k) => k.key === "calls_booked");
    expect(booked?.sub).toMatch(/3 cancelled/);
  });
});
