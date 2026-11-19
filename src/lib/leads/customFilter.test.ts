import { describe, expect, it } from "vitest";
import {
  customConditionChipLabel,
  customFilterYields,
  encodeCustomFilter,
  parseCustomFilterParam,
  validateCustomFilter
} from "@/lib/leads/customFilter";
import {
  applyCustomFilter,
  conditionToFragment,
  customFilterOrParam,
  encodePostgrestValue,
  escapeIlikePattern
} from "@/lib/leads/customFilterQuery";

describe("validateCustomFilter", () => {
  it("rejects unknown fields and operators", () => {
    expect(
      validateCustomFilter({
        match: "all",
        conditions: [{ field: "not_a_field", op: "is", value: "x" }]
      }).ok
    ).toBe(false);
    expect(
      validateCustomFilter({
        match: "all",
        conditions: [{ field: "name", op: "is_any", value: ["x"] }]
      }).ok
    ).toBe(false);
  });

  it("rejects wrongly typed values", () => {
    expect(
      validateCustomFilter({
        match: "all",
        conditions: [{ field: "contact_attempts", op: "gte", value: "three" }]
      }).ok
    ).toBe(false);
    expect(
      validateCustomFilter({
        match: "all",
        conditions: [{ field: "created_at", op: "in_last", value: 0 }]
      }).ok
    ).toBe(false);
    expect(
      validateCustomFilter({
        match: "all",
        conditions: [{ field: "deal", op: "is_any", value: [] }]
      }).ok
    ).toBe(false);
  });

  it("accepts the four example shapes", () => {
    expect(
      validateCustomFilter({
        match: "all",
        conditions: [{ field: "deal", op: "is_any", value: ["lost"] }]
      }).ok
    ).toBe(true);
    expect(
      validateCustomFilter({
        match: "all",
        conditions: [
          { field: "form_qualified", op: "is_yes" },
          { field: "call_booked_at", op: "is_not_empty" }
        ]
      }).ok
    ).toBe(true);
    expect(
      validateCustomFilter({
        match: "all",
        conditions: [
          { field: "call_showed", op: "is_yes" },
          {
            field: "post_call_status",
            op: "is_any",
            value: ["awaiting_lead_response", "contract_shared"]
          }
        ]
      }).ok
    ).toBe(true);
    expect(
      validateCustomFilter({
        match: "all",
        conditions: [
          {
            field: "custom_fields.what_is_your_current_monthly_revenue?",
            op: "contains",
            value: "5000"
          },
          { field: "created_at", op: "in_last", value: 14 },
          { field: "contact_attempts", op: "gte", value: 3 }
        ]
      }).ok
    ).toBe(true);
  });
});

describe("encode / decode cf param", () => {
  it("round-trips a filter through the URL param", () => {
    const encoded = encodeCustomFilter({
      match: "any",
      conditions: [
        { id: "a", field: "lead_source", op: "is_any", value: ["youtube"] },
        { id: "b", field: "lead_source", op: "is_any", value: ["ig"] }
      ]
    });
    expect(encoded).toBeTruthy();
    const parsed = parseCustomFilterParam(encoded);
    expect(parsed?.match).toBe("any");
    expect(parsed?.conditions.map((c) => c.field)).toEqual(["lead_source", "lead_source"]);
  });
});

describe("conditionToFragment", () => {
  it("escapes % and _ in contains", () => {
    expect(escapeIlikePattern("100%_off")).toBe("100\\%\\_off");
    expect(
      conditionToFragment({
        id: "1",
        field: "name",
        op: "contains",
        value: "a,b(c)"
      })
    ).toBe(`name.ilike.${encodePostgrestValue("%a,b(c)%")}`);
  });

  it("null-safe is not / does not contain / is none of", () => {
    expect(
      conditionToFragment({ id: "1", field: "lead_source", op: "is_none", value: ["facebook"] })
    ).toBe('or(lead_source.is.null,lead_source.not.in.(facebook))');
    expect(
      conditionToFragment({ id: "1", field: "name", op: "is_not", value: "Ada" })
    ).toBe('or(name.is.null,name.eq."",name.neq.Ada)');
    expect(
      conditionToFragment({ id: "1", field: "notes", op: "not_contains", value: "spam" })
    ).toBe('or(notes.is.null,notes.eq."",notes.not.ilike.%spam%)');
  });

  it("uses IST day bounds for date operators", () => {
    const before = conditionToFragment({
      id: "1",
      field: "created_at",
      op: "before",
      value: "2026-11-01"
    });
    expect(before).toMatch(/^created_at\.lt\.2026-10-31T18:30:00/);
    const last = conditionToFragment(
      { id: "1", field: "created_at", op: "in_last", value: 14 },
      "2026-11-19"
    );
    expect(last).toContain("created_at.gte.2026-11-05T18:30:00");
    expect(last).toContain("created_at.lte.2026-11-19T18:29:59");
  });

  it("translates Deal lost and number comparisons", () => {
    expect(
      conditionToFragment({ id: "1", field: "deal", op: "is_any", value: ["lost"] })
    ).toBe("deal_closed.eq.false");
    expect(
      conditionToFragment({ id: "1", field: "contact_attempts", op: "gte", value: 3 })
    ).toBe("contact_attempts.gte.3");
  });

  it("quotes commas and parentheses inside OR values", () => {
    const frag = conditionToFragment({
      id: "1",
      field: "name",
      op: "is",
      value: "foo,bar(baz)"
    });
    expect(frag).toBe(`name.eq.${encodePostgrestValue("foo,bar(baz)")}`);
    expect(encodePostgrestValue("foo,bar(baz)")).toMatch(/^"/);
    const orParam = customFilterOrParam({
      match: "any",
      conditions: [
        { id: "a", field: "name", op: "is", value: "foo,bar(baz)" },
        { id: "b", field: "email", op: "contains", value: "x" }
      ]
    });
    expect(orParam).toContain(encodePostgrestValue("foo,bar(baz)"));
    expect(orParam).toContain("email.ilike.%x%");
  });

  it("AND mode wraps conditions in a single escaped and()", () => {
    const calls: string[] = [];
    const query = { or: (expr: string) => { calls.push(expr); return query; } };
    applyCustomFilter(query, {
      match: "all",
      conditions: [
        { id: "a", field: "form_qualified", op: "is_yes" },
        { id: "b", field: "name", op: "is", value: "foo,bar(baz)" }
      ]
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(
      `and(form_qualified.eq.true,or(name.eq.${encodePostgrestValue("foo,bar(baz)")}))`
    );
  });
});

describe("customFilterYields", () => {
  it("yields hide-dead for Deal / Dead, and form-unqualified for Form Qualified", () => {
    expect(
      customFilterYields({
        match: "all",
        conditions: [{ id: "1", field: "deal", op: "is_any", value: ["lost"] }]
      })
    ).toEqual({ dead: true, formQualified: false });
    expect(
      customFilterYields({
        match: "all",
        conditions: [{ id: "1", field: "form_qualified", op: "is_yes" }]
      })
    ).toEqual({ dead: false, formQualified: true });
    expect(
      customFilterYields({
        match: "all",
        conditions: [{ id: "1", field: "name", op: "contains", value: "a" }]
      })
    ).toEqual({ dead: false, formQualified: false });
  });
});

describe("customConditionChipLabel", () => {
  it("renders Deal is Lost and Attempts ≥ 3", () => {
    expect(
      customConditionChipLabel({ id: "1", field: "deal", op: "is_any", value: ["lost"] })
    ).toBe("Deal is Lost");
    expect(
      customConditionChipLabel({ id: "2", field: "contact_attempts", op: "gte", value: 3 })
    ).toBe("Attempts ≥ 3");
  });
});
