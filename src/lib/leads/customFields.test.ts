import { describe, expect, it } from "vitest";
import {
  compactCustomFields,
  humanizeFieldKey,
  mergeCustomFields,
  resolveWebsiteFieldValue,
  WEBSITE_CANONICAL_CUSTOM_FIELD_KEYS
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

describe("WEBSITE_CANONICAL_CUSTOM_FIELD_KEYS", () => {
  it("matches Quickform long-form keys (not legacy short names)", () => {
    expect([...WEBSITE_CANONICAL_CUSTOM_FIELD_KEYS]).toEqual([
      "what_describes_you_best?",
      "what_is_your_biggest_goal_right_now?",
      "what_is_your_current_monthly_revenue?",
      "what_is_your_investment_capacity?"
    ]);
  });
});

describe("resolveWebsiteFieldValue", () => {
  it("maps legacy short top-level keys onto canonical long keys", () => {
    expect(
      resolveWebsiteFieldValue(
        [{ describes_you: "Founder" }],
        "what_describes_you_best?"
      )
    ).toBe("Founder");
  });

  it("accepts already-canonical keys and form_answers", () => {
    expect(
      resolveWebsiteFieldValue(
        [
          null,
          {
            "what_is_your_biggest_goal_right_now?": "Scale"
          }
        ],
        "what_is_your_biggest_goal_right_now?"
      )
    ).toBe("Scale");
  });

  it("prefers the first non-empty source", () => {
    expect(
      resolveWebsiteFieldValue(
        [
          { monthly_revenue: "10k" },
          { "what_is_your_current_monthly_revenue?": "20k" }
        ],
        "what_is_your_current_monthly_revenue?"
      )
    ).toBe("10k");
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
