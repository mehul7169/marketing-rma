import { describe, expect, it } from "vitest";
import { parseExistingRows, planUpsert } from "@/lib/adspend/upsertPlan";

const HEADER = ["Date", "Client", "Ad Spent", "Calls Booked"];

describe("planUpsert", () => {
  it("updates column C for an existing (date, client) and does not duplicate", () => {
    const existing = parseExistingRows([
      HEADER,
      ["24/11/2026", "Karan", "10000", ""],
      ["24/11/2026", "Manan", "2914", ""]
    ]);
    const plan = planUpsert(existing, [
      { dateISO: "2026-11-24", client: "Karan", spend: 10179 },
      { dateISO: "2026-11-24", client: "Manan", spend: 2914 }
    ]);
    expect(plan.updates).toHaveLength(2);
    expect(plan.updates[0]).toMatchObject({ rowNumber: 2, spend: 10179, client: "Karan" });
    expect(plan.appends).toHaveLength(0);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.rowCount).toBe(2);
  });

  it("appends a new date in tracker order", () => {
    const existing = parseExistingRows([
      HEADER,
      ["24/11/2026", "Karan", "10179", ""]
    ]);
    const plan = planUpsert(existing, [
      { dateISO: "2026-11-25", client: "Karan", spend: 10 },
      { dateISO: "2026-11-25", client: "Manan", spend: 0 }
    ]);
    expect(plan.updates).toHaveLength(0);
    expect(plan.appends).toHaveLength(1);
    expect(plan.appends[0]?.rows.map((r) => r.client)).toEqual(["Karan", "Manan"]);
    expect(plan.appends[0]?.rows[0]?.dateSheet).toBe("25/11/2026");
  });

  it("inserts a missing client after the last row of that date", () => {
    const existing = parseExistingRows([
      HEADER,
      ["24/11/2026", "Karan", "10179", ""],
      ["25/11/2026", "Karan", "1", ""]
    ]);
    const plan = planUpsert(existing, [
      { dateISO: "2026-11-24", client: "Abhay", spend: 1518 }
    ]);
    expect(plan.inserts).toEqual([
      expect.objectContaining({
        afterRow: 2,
        rows: [expect.objectContaining({ client: "Abhay", spend: 1518, dateSheet: "24/11/2026" })]
      })
    ]);
  });

  it("writes ₹0 for a validated client with no Meta rows", () => {
    const plan = planUpsert([], [{ dateISO: "2026-11-24", client: "Eshaan", spend: 0 }]);
    expect(plan.appends[0]?.rows[0]?.spend).toBe(0);
  });
});
