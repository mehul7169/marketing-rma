import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLead } from "@/test/fixtures";

const getLeadById = vi.fn();
const commitLeadChange = vi.fn();
const requireWritableOrgId = vi.fn();

vi.mock("@/lib/auth/getCurrentOrgId", () => ({
  requireWritableOrgId: () => requireWritableOrgId()
}));
vi.mock("@/lib/db/leads", () => ({
  getLeadById: (...a: unknown[]) => getLeadById(...a),
  commitLeadChange: (...a: unknown[]) => commitLeadChange(...a)
}));

import { updateLeadFields, updateLeadLifecycle } from "@/lib/leads/updateLeadLifecycle";

const actor = { userId: "u1", email: "setter@x.com" };

beforeEach(() => {
  vi.clearAllMocks();
  requireWritableOrgId.mockResolvedValue("org-1");
  commitLeadChange.mockImplementation(async (lead, patch) => makeLead({ ...lead, ...patch }));
});

describe("updateLeadLifecycle", () => {
  it("checks the org first and writes nothing during preview", async () => {
    requireWritableOrgId.mockRejectedValue(new Error("Read-only preview"));
    await expect(updateLeadLifecycle("l1", "qualify", {}, actor)).rejects.toThrow("Read-only preview");
    expect(getLeadById).not.toHaveBeenCalled();
    expect(commitLeadChange).not.toHaveBeenCalled();
  });

  it("loads the lead in the caller's org", async () => {
    getLeadById.mockResolvedValue(null);
    expect(await updateLeadLifecycle("l1", "qualify", {}, actor)).toEqual({ ok: false, error: "Lead not found" });
    expect(getLeadById).toHaveBeenCalledWith("l1", "org-1");
  });

  it("validation failure writes neither the lead nor an activity (no orphan rows)", async () => {
    getLeadById.mockResolvedValue(makeLead({ first_contacted_at: null }));
    const res = await updateLeadLifecycle("l1", "book_call", { scheduledFor: "2026-10-29T10:00:00.000Z" }, actor);
    expect(res).toEqual({ ok: false, error: "Log a call attempt before booking a call." });
    expect(commitLeadChange).not.toHaveBeenCalled();
  });

  it("commits patch + activities together, stamped with the actor", async () => {
    const lead = makeLead({ call_booked_at: "2026-10-21T10:00:00.000Z" });
    getLeadById.mockResolvedValue(lead);
    const res = await updateLeadLifecycle("l1", "mark_no_show", {}, actor);
    expect(res.ok).toBe(true);
    const [sentLead, patch, activities] = commitLeadChange.mock.calls[0];
    expect(sentLead).toBe(lead);
    expect(patch).toMatchObject({ call_showed: false, call_showed_at: null, is_dead: true, dead_reason: "no_show" });
    expect(activities).toEqual([
      { type: "show_outcome", outcome: "no_show", note: null, created_by: "u1" }
    ]);
  });
});

describe("updateLeadFields", () => {
  it("logs one field_edited activity listing the changed keys", async () => {
    getLeadById.mockResolvedValue(makeLead({ notes: "old", deal_value: 5, custom_fields: { a: 1 } }));
    await updateLeadFields("l1", { notes: "new", deal_value: 5, custom_fields: { b: "x" } }, actor);
    const [, patch, activities] = commitLeadChange.mock.calls[0];
    expect(patch).toMatchObject({ notes: "new", custom_fields: { a: 1, b: "x" } });
    expect(activities).toEqual([
      { type: "field_edited", outcome: null, note: "notes, custom_fields.b", created_by: "u1" }
    ]);
  });

  it("skips the write when nothing changed", async () => {
    getLeadById.mockResolvedValue(makeLead({ notes: "same" }));
    const res = await updateLeadFields("l1", { notes: "same" }, actor);
    expect(res.ok).toBe(true);
    expect(commitLeadChange).not.toHaveBeenCalled();
  });
});
