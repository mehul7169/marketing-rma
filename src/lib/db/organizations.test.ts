import { describe, expect, it } from "vitest";
import { parseMonthlyTarget } from "@/lib/db/organizations";

describe("parseMonthlyTarget", () => {
  it("accepts revenue goals and rejects anything else", () => {
    expect(parseMonthlyTarget({ metric: "revenue", value: 3_000_000 })).toEqual({
      metric: "revenue",
      value: 3_000_000
    });
    expect(parseMonthlyTarget(null)).toBeNull();
    expect(parseMonthlyTarget({ metric: "leads", value: 100 })).toBeNull();
    expect(parseMonthlyTarget({ metric: "revenue", value: 0 })).toBeNull();
  });
});
