import { describe, expect, it } from "vitest";
import { contrastRatio, KNOWN_FAIL, TOKEN_PAIRS } from "@/lib/ui/contrast";

describe("design tokens WCAG AA", () => {
  it("meets 4.5:1 for every shipped text/background pair", () => {
    for (const pair of TOKEN_PAIRS) {
      const ratio = contrastRatio(pair.fg, pair.bg);
      expect(ratio, pair.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("documents the spec accent-text on surface-2 miss", () => {
    expect(contrastRatio(KNOWN_FAIL.fg, KNOWN_FAIL.bg)).toBeLessThan(4.5);
  });
});
