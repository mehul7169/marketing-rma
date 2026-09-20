import { describe, expect, it } from "vitest";
import { sheetFieldsForLeadUpdate } from "@/lib/db/leads";
import { formatUnknownError } from "@/lib/utils/formatUnknownError";
import { makeLead } from "@/test/fixtures";

describe("formatUnknownError", () => {
  it("reads Error.message", () => {
    expect(formatUnknownError(new Error("boom"))).toBe("boom");
  });

  it("serializes PostgREST-shaped plain objects (not [object Object])", () => {
    const msg = formatUnknownError({
      message: "duplicate key value violates unique constraint",
      code: "23505",
      details: "Key (email)=(a@b.com) already exists.",
      hint: null
    });
    expect(msg).toContain("duplicate key value violates unique constraint");
    expect(msg).toContain("code=23505");
    expect(msg).toContain("Key (email)=(a@b.com) already exists.");
    expect(msg).not.toContain("[object Object]");
  });

  it("does not turn objects into [object Object] via String()", () => {
    expect(formatUnknownError({ foo: 1 })).toBe('{"foo":1}');
  });
});

describe("sheetFieldsForLeadUpdate", () => {
  it("does not clobber an existing phone", () => {
    const existing = makeLead({ phone: "+1-555-0100", name: "Ada" });
    const patch = sheetFieldsForLeadUpdate(existing, {
      name: "Ada Lovelace",
      phone: "+1-555-9999",
      utm_campaign: "spring",
      custom_fields: { platform: "FB" }
    });
    expect(patch.phone).toBe("+1-555-0100");
    expect(patch.name).toBe("Ada Lovelace");
    expect(patch.utm_campaign).toBe("spring");
    expect(patch.custom_fields).toMatchObject({ platform: "FB" });
  });

  it("fills phone when existing is empty", () => {
    const existing = makeLead({ phone: null });
    const patch = sheetFieldsForLeadUpdate(existing, {
      phone: "+1-555-9999"
    });
    expect(patch.phone).toBe("+1-555-9999");
  });

  it("never includes workflow fields", () => {
    const existing = makeLead({
      qualified: true,
      notes: "keep me",
      contact_attempts: 2,
      action_status: "Personally Contacted"
    });
    const patch = sheetFieldsForLeadUpdate(existing, {
      name: "New",
      custom_fields: { x: 1 }
    });
    expect(patch).not.toHaveProperty("qualified");
    expect(patch).not.toHaveProperty("notes");
    expect(patch).not.toHaveProperty("contact_attempts");
    expect(patch).not.toHaveProperty("action_status");
    expect(patch).not.toHaveProperty("stage");
    expect(patch).not.toHaveProperty("is_dead");
  });
});
