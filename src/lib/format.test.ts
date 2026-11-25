import { describe, expect, it } from "vitest";
import { formatInr, formatInrCompact } from "@/lib/format";

describe("formatInr", () => {
  it("uses Indian grouping and rupee sign", () => {
    expect(formatInr(525_000)).toBe("₹5,25,000");
    expect(formatInr(0)).toBe("₹0");
  });
});

describe("formatInrCompact", () => {
  it("uses L and Cr with trimmed decimals", () => {
    expect(formatInrCompact(525_000)).toBe("₹5.25L");
    expect(formatInrCompact(12_000_000)).toBe("₹1.2Cr");
    expect(formatInrCompact(0)).toBe("₹0");
  });

  it("stays grouped below one lakh", () => {
    expect(formatInrCompact(99_999)).toBe("₹99,999");
  });
});
