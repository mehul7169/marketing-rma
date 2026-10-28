import { describe, expect, it } from "vitest";
import { makeLatestWins } from "@/lib/leads/latestWins";

describe("makeLatestWins", () => {
  it("treats only the newest begin() as latest", () => {
    const w = makeLatestWins();
    const a = w.begin();
    const b = w.begin();
    expect(w.isLatest(a)).toBe(false);
    expect(w.isLatest(b)).toBe(true);
  });
});
