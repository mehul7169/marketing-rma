import { describe, expect, it } from "vitest";
import { eachIsoDay, isoToSheetDate, sheetDateToIso } from "@/lib/adspend/dates";

describe("adspend dates", () => {
  it("round-trips dd/mm/yyyy as IST sheet dates, not US mm/dd", () => {
    expect(isoToSheetDate("2026-11-24")).toBe("24/11/2026");
    expect(sheetDateToIso("24/11/2026")).toBe("2026-11-24");
    expect(sheetDateToIso("4/1/2026")).toBe("2026-01-04");
    expect(sheetDateToIso("2026-11-24")).toBe("2026-11-24");
    expect(sheetDateToIso("")).toBeNull();
  });

  it("lists inclusive ISO days", () => {
    expect(eachIsoDay("2026-11-22", "2026-11-24")).toEqual([
      "2026-11-22",
      "2026-11-23",
      "2026-11-24"
    ]);
  });
});
