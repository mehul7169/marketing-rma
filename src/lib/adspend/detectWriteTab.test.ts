import { describe, expect, it } from "vitest";
import { dataRangeHasFormula, resolveWriteTarget } from "@/lib/adspend/detectWriteTab";

describe("resolveWriteTarget", () => {
  it("prefers Daily Ad Spend when that tab exists and is values", () => {
    const t = resolveWriteTarget({
      dataFormulaValues: [["Date"], ['=ARRAYFORMULA("x")']],
      tabNames: ["Data", "Daily Ad Spend", "Tracker names"],
      dailyFormulaValues: [["Date", "Client", "Ad Spent", "Calls Booked"]]
    });
    expect(t.tab).toBe("Daily Ad Spend");
    expect(t.reason).toMatch(/Daily Ad Spend/);
  });

  it("writes Feed when Data is formula-driven and Daily Ad Spend is missing", () => {
    const values = [
      ["Date", "Client", "Ad Spent", "Calls Booked"],
      ['={ \'Manual entries\'!A2:D; Feed!A2:D }', "", "", ""]
    ];
    expect(dataRangeHasFormula(values)).toBe(true);
    const t = resolveWriteTarget({ dataFormulaValues: values });
    expect(t.tab).toBe("Feed");
    expect(t.reason).toMatch(/Feed/);
  });

  it("writes Data when the tab is plain values", () => {
    const values = [
      ["Date", "Client", "Ad Spent", "Calls Booked"],
      ["24/11/2026", "Karan", "10179", ""]
    ];
    const t = resolveWriteTarget({ dataFormulaValues: values });
    expect(t.tab).toBe("Data");
    expect(t.dataHasFormula).toBe(false);
  });

  it("treats ARRAYFORMULA in A1 as formula-driven", () => {
    const t = resolveWriteTarget({
      dataFormulaValues: [['=ARRAYFORMULA(QUERY({...}))', "", "", ""]]
    });
    expect(t.tab).toBe("Feed");
  });
});
