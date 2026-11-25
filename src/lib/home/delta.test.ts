import { describe, expect, it } from "vitest";
import { periodDelta } from "@/lib/home/delta";

describe("periodDelta", () => {
  it("returns up/down percent vs an equal prior period", () => {
    expect(periodDelta(120, 100)).toEqual({
      direction: "up",
      pct: 20,
      label: "20%"
    });
    expect(periodDelta(80, 100)).toEqual({
      direction: "down",
      pct: -20,
      label: "20%"
    });
    expect(periodDelta(100, 100)).toEqual({
      direction: "flat",
      pct: 0,
      label: "0%"
    });
  });

  it("hides the delta when the prior period is empty", () => {
    expect(periodDelta(10, 0)).toBeNull();
  });
});
