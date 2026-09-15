import { describe, expect, it } from "vitest";
import { makeLead } from "@/test/fixtures";
import { filterWorkQueueLeads } from "@/lib/leads/workQueueSearch";

describe("filterWorkQueueLeads", () => {
  const rows = [
    makeLead({
      id: "1",
      name: "Priya Sharma",
      email: "priya@agency.com",
      phone: "+91 98765 43210"
    }),
    makeLead({
      id: "2",
      name: "Alex Chen",
      email: "alex@example.com",
      phone: "415-555-0100"
    }),
    makeLead({
      id: "3",
      name: null,
      email: "noreply@brand.io",
      phone: null
    })
  ];

  it("returns all rows for empty query", () => {
    expect(filterWorkQueueLeads(rows, "")).toHaveLength(3);
    expect(filterWorkQueueLeads(rows, "   ")).toHaveLength(3);
  });

  it("matches partial name (case-insensitive)", () => {
    expect(filterWorkQueueLeads(rows, "priya").map((r) => r.id)).toEqual(["1"]);
    expect(filterWorkQueueLeads(rows, "CHEN").map((r) => r.id)).toEqual(["2"]);
  });

  it("matches partial email", () => {
    expect(filterWorkQueueLeads(rows, "agency").map((r) => r.id)).toEqual(["1"]);
    expect(filterWorkQueueLeads(rows, "brand.io").map((r) => r.id)).toEqual([
      "3"
    ]);
  });

  it("matches phone ignoring punctuation/spaces", () => {
    expect(filterWorkQueueLeads(rows, "98765").map((r) => r.id)).toEqual(["1"]);
    expect(filterWorkQueueLeads(rows, "4155550100").map((r) => r.id)).toEqual([
      "2"
    ]);
    expect(filterWorkQueueLeads(rows, "(415) 555").map((r) => r.id)).toEqual([
      "2"
    ]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterWorkQueueLeads(rows, "zzzz-nope")).toHaveLength(0);
  });
});
