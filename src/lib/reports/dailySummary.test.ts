import { describe, expect, it } from "vitest";
import { buildDailySummaryMessage, setterName, type DailySummaryData } from "@/lib/reports/dailySummary";
import { emptyCounts } from "@/lib/insights/setterActivity";

const counts = (dials: number, callsBooked: number) => ({
  ...emptyCounts(),
  dials,
  callsBooked,
  noAnswer: 1,
  unqualified: 2,
  followUp: 3
});

function data(overrides: Partial<DailySummaryData> = {}): DailySummaryData {
  return {
    dateISO: "2026-09-30",
    // 14:30 UTC = 8:00 PM IST
    asOf: new Date("2026-09-30T14:30:05Z"),
    setter: {
      daily: [],
      users: [
        { userId: "u1", label: "aishavryaa@runmoreads.in", ...counts(10, 2) },
        { userId: "u2", label: "raj@runmoreads.in", ...counts(5, 1) }
      ],
      orgTotals: counts(15, 3),
      userTotals: counts(15, 3)
    },
    adSpend: 12345.6,
    leadsReceived: 23,
    callsBooked: 3,
    metaLastRun: { ranAt: "2026-09-30T14:00:10Z", ok: true },
    ...overrides
  };
}

function allText(blocks: Record<string, unknown>[]): string {
  return JSON.stringify(blocks);
}

describe("buildDailySummaryMessage", () => {
  it("labels the numbers as today-so-far at 8:00 PM IST", () => {
    const { text, blocks } = buildDailySummaryMessage(data());
    expect(blocks[0]).toMatchObject({ type: "header" });
    expect(allText(blocks)).toContain("Today so far, as of 8:00 PM IST");
    expect(text).toContain("as of 8:00 PM IST");
    expect(allText(blocks)).toContain("Wed 30 Sep 2026");
  });

  it("lists each setter plus a team total when there is more than one", () => {
    const json = allText(buildDailySummaryMessage(data()).blocks);
    expect(json).toContain("*Aishavryaa*\\n10 dials · 2 booked · 1 no answer · 2 unqualified · 3 follow-up");
    expect(json).toContain("*Raj*\\n5 dials");
    expect(json).toContain("*Team total*\\n15 dials · 3 booked");
  });

  it("omits the team total for a single setter and handles no calls", () => {
    const one = data();
    one.setter.users = one.setter.users.slice(0, 1);
    expect(allText(buildDailySummaryMessage(one).blocks)).not.toContain("Team total");

    const none = data();
    none.setter.users = [];
    none.setter.orgTotals = emptyCounts();
    expect(allText(buildDailySummaryMessage(none).blocks)).toContain("No calls logged yet today");
  });

  it("shows marketing numbers and only flags booked divergence when it exists", () => {
    const same = allText(buildDailySummaryMessage(data()).blocks);
    expect(same).toContain("Ad spend: *₹12,346*");
    expect(same).toContain("Leads received: *23*");
    expect(same).toContain("Calls booked: *3*");
    expect(same).not.toContain("Calls booked differ");

    const diff = allText(buildDailySummaryMessage(data({ callsBooked: 5 })).blocks);
    expect(diff).toContain("5 leads booked today vs 3 booked on a logged setter call");
  });

  it("warns when the latest Meta sync failed", () => {
    const ok = allText(buildDailySummaryMessage(data()).blocks);
    expect(ok).toContain("Meta sync at 7:30 PM IST");
    const failed = allText(
      buildDailySummaryMessage(data({ metaLastRun: { ranAt: "2026-09-30T14:00:10Z", ok: false } })).blocks
    );
    expect(failed).toContain("failed — ad spend may be stale");
  });
});

describe("setterName", () => {
  it("uses the capitalised email local part", () => {
    expect(setterName("test-member@runmoreads.in")).toBe("Test-member");
    expect(setterName("Unknown")).toBe("Unknown");
  });
});
