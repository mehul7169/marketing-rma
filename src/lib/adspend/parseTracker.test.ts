import { describe, expect, it } from "vitest";
import { actId, parseAdAccountId, parseTrackerRows } from "@/lib/adspend/parseTracker";

const HEADER = ["Name in Client Ad Tracker", "Ad Account Id", "Name in Clients list"];

describe("parseAdAccountId", () => {
  it("keeps 16-digit ids as strings and rejects Number() rounding", () => {
    const id = "9935669047237741";
    expect(parseAdAccountId(id)).toBe(id);
    expect(parseAdAccountId(id)).not.toBe(String(Number(id)));
    expect(parseAdAccountId(" 105914420408512 ")).toBe("105914420408512");
    expect(parseAdAccountId("act_123")).toBeNull();
    expect(parseAdAccountId("1.059E+14")).toBeNull();
    expect(parseAdAccountId("")).toBeNull();
  });
});

describe("parseTrackerRows", () => {
  it("syncs rows with a digit id and skips empty B as no ad account ID", () => {
    const parsed = parseTrackerRows([
      HEADER,
      ["Kreative & Co", "993566904723774", "Karan"],
      ["Directive Labs", "", "Eshaan"],
      ["Gaurav", "  ", "Gaurav"],
      ["Deepak Snapscale", "", "Deepak"],
      ["ScaleUp Media", "", "ScaleUp"],
      ["Modernizing Processes", "105914420408512", "Manan"]
    ]);
    expect(parsed.synced.map((r) => r.clientName)).toEqual(["Karan", "Manan"]);
    expect(parsed.synced[0]?.adAccountId).toBe("993566904723774");
    expect(parsed.skipped.map((s) => `${s.clientName}:${s.reason}`)).toEqual([
      "Eshaan:no ad account ID",
      "Gaurav:no ad account ID",
      "Deepak:no ad account ID",
      "ScaleUp:no ad account ID"
    ]);
  });

  it("skips scientific-notation ids that Sheets rounded", () => {
    const parsed = parseTrackerRows([
      HEADER,
      ["X", "1.05914E+14", "Manan"]
    ]);
    expect(parsed.synced).toHaveLength(0);
    expect(parsed.skipped[0]?.reason).toBe("invalid ad account ID");
  });

  it("prefixes act_ without parsing the id as a number", () => {
    expect(actId("9935669047237741")).toBe("act_9935669047237741");
  });
});
