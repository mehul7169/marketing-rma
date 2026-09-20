import { describe, expect, it } from "vitest";
import {
  LEAD_LIST_PAGE_SIZE,
  pageOffset,
  parsePageParam,
  totalPages
} from "@/lib/leads/pagination";

describe("lead list pagination", () => {
  it("uses a fixed page size of 50", () => {
    expect(LEAD_LIST_PAGE_SIZE).toBe(50);
  });

  it("parses page params safely", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-2")).toBe(1);
    expect(parsePageParam("3")).toBe(3);
    expect(parsePageParam("nope")).toBe(1);
  });

  it("computes offset and total pages", () => {
    expect(pageOffset(1)).toBe(0);
    expect(pageOffset(2)).toBe(50);
    expect(totalPages(0)).toBe(1);
    expect(totalPages(50)).toBe(1);
    expect(totalPages(51)).toBe(2);
  });
});
