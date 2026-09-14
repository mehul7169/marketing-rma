import { describe, expect, it } from "vitest";
import {
  compactCustomFields,
  humanizeFieldKey,
  mergeCustomFields
} from "@/lib/leads/customFields";

describe("humanizeFieldKey", () => {
  it.each([
    ["describes_you", "Describes You"],
    ["what_describes_you_best?", "What Describes You Best?"],
    ["biggest_goal", "Biggest Goal"],
    ["Business Description", "Business Description"],
    ["", ""]
  ])("%j → %j", (input, expected) => {
    expect(humanizeFieldKey(input)).toBe(expected);
  });
});

describe("compactCustomFields / mergeCustomFields", () => {
  it("skips null, undefined, and blank strings", () => {
    expect(
      compactCustomFields({
        a: "ok",
        b: "",
        c: "  ",
        d: null,
        e: undefined,
        f: 0
      })
    ).toEqual({ a: "ok", f: 0 });
  });

  it("merges with incoming winning on clash", () => {
    expect(
      mergeCustomFields({ a: "old", b: "keep" }, { a: "new", c: "added" })
    ).toEqual({ a: "new", b: "keep", c: "added" });
  });
});
