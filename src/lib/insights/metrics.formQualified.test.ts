import { describe, expect, it } from "vitest";
import { computeInsights } from "@/lib/insights/metrics";
import { makeLead } from "@/test/fixtures";

const IN = "2026-09-10T06:00:00.000Z";
const known = { byAdId: new Map<string, string>(), byAdName: new Map() };

describe("computeInsights form-qualified rate", () => {
  it("counts the form's verdict, not the setter's decision", () => {
    const leads = [
      makeLead({ id: "a", created_at: IN, form_filled_at: IN, form_qualified: true, qualified: null }),
      makeLead({ id: "b", created_at: IN, form_filled_at: IN, form_qualified: false, qualified: true }),
      makeLead({ id: "c", created_at: IN, form_filled_at: IN, form_qualified: null })
    ];
    const m = computeInsights(leads, new Map(), known, "2026-09-01", "2026-09-30");
    expect(m.formQualified).toMatchObject({ numerator: 1, denominator: 3 });
  });

  it("Qualified Rate is Qualified / Contacted by milestone timestamps", () => {
    const leads = [
      makeLead({ id: "c1", first_contacted_at: IN }),
      makeLead({
        id: "q1",
        first_contacted_at: IN,
        qualified: true,
        qualified_at: IN
      }),
      makeLead({ id: "later", first_contacted_at: "2026-08-01T06:00:00.000Z" })
    ];
    const m = computeInsights(leads, new Map(), known, "2026-09-01", "2026-09-30");
    expect(m.qualified).toMatchObject({ numerator: 1, denominator: 2 });
  });
});
