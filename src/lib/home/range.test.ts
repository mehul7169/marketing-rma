import { describe, expect, it } from "vitest";
import {
  bucketKey,
  istMonthEnd,
  istMonthStart,
  istWeekStart,
  iterateBucketKeys,
  rangeToFromTo,
  trendBucketFor
} from "@/lib/home/range";

describe("rangeToFromTo", () => {
  const today = "2026-11-23";
  it("maps presets to inclusive IST windows", () => {
    expect(rangeToFromTo("today", today)).toEqual({
      fromISO: "2026-11-23",
      toISO: "2026-11-23"
    });
    expect(rangeToFromTo("7d", today)).toEqual({
      fromISO: "2026-11-17",
      toISO: "2026-11-23"
    });
    expect(rangeToFromTo("30d", today)).toEqual({
      fromISO: "2026-10-25",
      toISO: "2026-11-23"
    });
    expect(rangeToFromTo("month", today)).toEqual({
      fromISO: "2026-11-01",
      toISO: "2026-11-23"
    });
    expect(rangeToFromTo("all", today).fromISO).toBe("2020-01-01");
  });
});

describe("trendBucketFor", () => {
  it("uses daily buckets for ranges of 30 days or less", () => {
    expect(trendBucketFor("30d", "2026-10-25", "2026-11-23")).toBe("day");
    expect(trendBucketFor("7d", "2026-11-17", "2026-11-23")).toBe("day");
  });

  it("uses weekly buckets for longer non-All ranges", () => {
    expect(trendBucketFor("month", "2026-10-01", "2026-11-23")).toBe("week");
  });

  it("uses monthly buckets for All", () => {
    expect(trendBucketFor("all", "2020-01-01", "2026-11-23")).toBe("month");
  });
});

describe("bucketKey", () => {
  it("keys weeks from Monday IST and months from YYYY-MM", () => {
    expect(istWeekStart("2026-11-23")).toBe("2026-11-23"); // Monday
    expect(istWeekStart("2026-11-25")).toBe("2026-11-23");
    expect(bucketKey("2026-11-25", "week")).toBe("2026-11-23");
    expect(bucketKey("2026-11-25", "month")).toBe("2026-11");
    expect(istMonthStart("2026-11-23")).toBe("2026-11-01");
    expect(istMonthEnd("2026-11-23")).toBe("2026-11-30");
  });
});

describe("iterateBucketKeys", () => {
  it("emits daily, weekly, and monthly keys", () => {
    expect(iterateBucketKeys("2026-11-01", "2026-11-03", "day")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03"
    ]);
    expect(iterateBucketKeys("2026-11-23", "2026-11-25", "week")).toEqual([
      "2026-11-23"
    ]);
    expect(iterateBucketKeys("2026-10-15", "2026-12-02", "month")).toEqual([
      "2026-10",
      "2026-11",
      "2026-12"
    ]);
  });
});
