import { describe, expect, it } from "vitest";
import { makeLead } from "@/test/fixtures";
import {
  buildFunnel,
  buildTrend,
  countKpis,
  filterTraffic,
  splitPaidOrganic,
  wonRevenue
} from "@/lib/home/metrics";

const FROM = "2026-11-01";
const TO = "2026-11-23";
const IN = "2026-11-10T06:00:00.000Z";

describe("filterTraffic", () => {
  it("keeps facebook as paid and youtube as organic", () => {
    const paid = makeLead({ id: "p", lead_source: "facebook" });
    const organic = makeLead({ id: "o", lead_source: "youtube" });
    expect(filterTraffic([paid, organic], "paid").map((l) => l.id)).toEqual(["p"]);
    expect(filterTraffic([paid, organic], "organic").map((l) => l.id)).toEqual([
      "o"
    ]);
  });
});

describe("wonRevenue", () => {
  it("sums deal_value and counts missing values as ₹0", () => {
    const a = makeLead({
      id: "a",
      deal_closed: true,
      closed_at: IN,
      deal_value: 400_000
    });
    const b = makeLead({
      id: "b",
      deal_closed: true,
      closed_at: IN,
      deal_value: null
    });
    expect(wonRevenue([a, b], FROM, TO)).toEqual({
      revenue: 400_000,
      won: 2,
      unvalued: 1
    });
  });
});

describe("buildFunnel", () => {
  it("splits paid/organic and reports booked ÷ contacted", () => {
    const leads = [
      makeLead({
        id: "1",
        lead_source: "facebook",
        created_at: IN,
        first_contacted_at: IN,
        call_booked_at: IN
      }),
      makeLead({
        id: "2",
        lead_source: "youtube",
        created_at: IN,
        first_contacted_at: IN
      }),
      makeLead({
        id: "3",
        lead_source: "facebook",
        created_at: IN
      })
    ];
    const steps = buildFunnel({
      leads,
      fromISO: FROM,
      toISO: TO,
      hrefFor: (kpi) => `/leads?kpi=${kpi}`
    });
    const contacted = steps.find((s) => s.kpi === "contacted")!;
    expect(contacted.paid).toBe(1);
    expect(contacted.organic).toBe(1);
    const leadsStep = steps.find((s) => s.kpi === "leads")!;
    expect(leadsStep.conversion?.label).toBe("67% contacted");
    expect(contacted.conversion?.label).toBe("50% booked");
  });
});

describe("buildTrend", () => {
  it("buckets by IST day", () => {
    const leads = [
      makeLead({
        id: "1",
        lead_source: "facebook",
        created_at: IN
      }),
      makeLead({
        id: "2",
        lead_source: "youtube",
        created_at: IN
      })
    ];
    const points = buildTrend({
      leads,
      kpi: "leads",
      fromISO: FROM,
      toISO: TO,
      bucket: "day",
      fillGaps: false
    });
    expect(points).toEqual([
      { date: "2026-11-10", paid: 1, organic: 1, total: 2 }
    ]);
  });
});

describe("countKpis", () => {
  it("uses lifecycleDefinitions milestone windows", () => {
    const lead = makeLead({
      created_at: IN,
      first_contacted_at: IN,
      call_booked_at: IN
    });
    const counts = countKpis([lead], FROM, TO);
    expect(counts.leads).toBe(1);
    expect(counts.calls_booked).toBe(1);
    expect(counts.showups).toBe(0);
  });
});

describe("splitPaidOrganic", () => {
  it("counts facebook vs youtube on the KPI window", () => {
    const split = splitPaidOrganic(
      [
        makeLead({ id: "p", lead_source: "facebook", created_at: IN }),
        makeLead({ id: "o", lead_source: "youtube", created_at: IN })
      ],
      "leads",
      FROM,
      TO
    );
    expect(split).toEqual({ paid: 1, organic: 1 });
  });
});
