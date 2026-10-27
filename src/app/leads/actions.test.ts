import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLead } from "@/test/fixtures";

const insertLeadActivity = vi.fn();
const getLeadById = vi.fn();
const updateLead = vi.fn();
const commitLeadChange = vi.fn();
const getLeadByEmail = vi.fn();
const getLeadByPhone = vi.fn();
const insertLead = vi.fn();
const requireWritableOrgId = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/getCurrentOrgId", () => ({
  requireWritableOrgId: () => requireWritableOrgId()
}));
vi.mock("@/lib/auth/session", () => ({
  getActorEmail: async () => "setter@example.com",
  getActorUserId: async () => "user-1"
}));
vi.mock("@/lib/db/lead_activities", () => ({
  insertLeadActivity: (...args: unknown[]) => insertLeadActivity(...args)
}));
vi.mock("@/lib/db/lead_reminders", () => ({
  insertLeadReminder: vi.fn(),
  resolveLeadReminder: vi.fn()
}));
vi.mock("@/lib/db/leads", () => ({
  getLeadById: (...args: unknown[]) => getLeadById(...args),
  updateLead: (...args: unknown[]) => updateLead(...args),
  commitLeadChange: (...args: unknown[]) => commitLeadChange(...args),
  getLeadByEmail: (...args: unknown[]) => getLeadByEmail(...args),
  getLeadByPhone: (...args: unknown[]) => getLeadByPhone(...args),
  insertLead: (...args: unknown[]) => insertLead(...args)
}));

import {
  createManualLeadAction,
  leadLifecycleAction,
  saveLeadActions,
  saveLeadPlainFieldsAction
} from "@/app/leads/actions";

beforeEach(() => {
  vi.clearAllMocks();
  requireWritableOrgId.mockResolvedValue("org-1");
  getLeadByEmail.mockResolvedValue(null);
  getLeadByPhone.mockResolvedValue(null);
  insertLead.mockImplementation(async (row) => makeLead({ ...row, id: "new-1" }));
  updateLead.mockImplementation(async (lead, patch) => makeLead({ ...lead, ...patch }));
  commitLeadChange.mockImplementation(async (lead, patch) => makeLead({ ...lead, ...patch }));
});

describe("saveLeadActions milestones", () => {
  it("logs an activity and updates last_action for Deal won", async () => {
    const lead = makeLead({
      call_showed: true,
      last_action: "Called — No Answer",
      last_action_at: "2026-09-21T09:55:55.106Z"
    });
    getLeadById.mockResolvedValue(lead);

    await saveLeadActions(lead.id, { deal_closed: true, deal_value: 1000 });

    const [, patch, activities] = commitLeadChange.mock.calls[0];
    expect(activities).toEqual([
      { type: "deal_outcome", outcome: "won", created_by: "user-1" }
    ]);
    expect(patch.last_action).toBe("Deal won");
    expect(patch.last_action_at > lead.last_action_at!).toBe(true);
  });

  it("leaves last_action alone for non-milestone edits", async () => {
    const lead = makeLead({ last_action: "Called — No Answer" });
    getLeadById.mockResolvedValue(lead);

    await saveLeadActions(lead.id, { reminder_sent: true });

    expect(commitLeadChange).not.toHaveBeenCalled();
    expect(updateLead.mock.calls[0][1]).not.toHaveProperty("last_action");
  });
});

describe("leadLifecycleAction", () => {
  it("returns hard-block messages instead of throwing", async () => {
    getLeadById.mockResolvedValue(makeLead({ call_booked_at: null }));
    const res = await leadLifecycleAction("lead-1", "mark_showed");
    expect(res).toEqual({ ok: false, error: "Book a call before marking it as showed." });
    expect(commitLeadChange).not.toHaveBeenCalled();
  });

  it("disqualify from the detail page marks the lead dead with not_qualified", async () => {
    getLeadById.mockResolvedValue(makeLead());
    const res = await leadLifecycleAction("lead-1", "disqualify");
    expect(res.ok).toBe(true);
    expect(commitLeadChange.mock.calls[0][1]).toMatchObject({
      qualified: false,
      qualified_by: "setter@example.com",
      is_dead: true,
      dead_reason: "not_qualified"
    });
  });
});

describe("saveLeadPlainFieldsAction", () => {
  it("routes an inline Call scheduled edit through book_call (and its hard block)", async () => {
    getLeadById.mockResolvedValue(makeLead({ call_booked_at: null, first_contacted_at: null }));
    const res = await saveLeadPlainFieldsAction("lead-1", { call_scheduled_for: "2026-10-29T10:00:00.000Z" });
    expect(res).toEqual({ ok: false, error: "Log a call attempt before booking a call." });
    expect(updateLead).not.toHaveBeenCalled();
    expect(commitLeadChange).not.toHaveBeenCalled();
  });

  it("reschedules when already booked", async () => {
    getLeadById.mockResolvedValue(
      makeLead({ call_booked_at: "2026-10-21T10:00:00.000Z", call_scheduled_for: "2026-10-25T10:00:00.000Z" })
    );
    const res = await saveLeadPlainFieldsAction("lead-1", { call_scheduled_for: "2026-10-29T10:00:00.000Z" });
    expect(res.ok).toBe(true);
    expect(commitLeadChange.mock.calls[0][2][0]).toMatchObject({ type: "reschedule" });
  });

  it("refuses to clear a booking inline", async () => {
    const res = await saveLeadPlainFieldsAction("lead-1", { call_scheduled_for: null });
    expect(res.ok).toBe(false);
    expect(commitLeadChange).not.toHaveBeenCalled();
  });

  it("logs plain edits as field_edited", async () => {
    getLeadById.mockResolvedValue(makeLead({ notes: null }));
    await saveLeadPlainFieldsAction("lead-1", { notes: "call after 6" });
    expect(commitLeadChange.mock.calls[0][2]).toEqual([
      { type: "field_edited", outcome: null, note: "notes", created_by: "user-1" }
    ]);
  });
});

describe("createManualLeadAction", () => {
  const input = {
    name: " Priya Referral ",
    phone: "p:+91 98765 43210",
    email: "",
    source: "referral",
    notes: "Referred by Harsh"
  };

  it("inserts an org-scoped fresh lead and logs the creator in lead_activities", async () => {
    const res = await createManualLeadAction(input);

    expect(res.ok).toBe(true);
    expect(insertLead).toHaveBeenCalledWith({
      org_id: "org-1",
      email: "manual-phone-919876543210@manual.invalid",
      name: "Priya Referral",
      phone: "+91 98765 43210",
      lead_source: "referral",
      notes: "Referred by Harsh"
    });
    const row = insertLead.mock.calls[0][0];
    expect(row).not.toHaveProperty("qualified");
    expect(row).not.toHaveProperty("action_status");
    expect(insertLeadActivity).toHaveBeenCalledWith({
      org_id: "org-1",
      lead_id: "new-1",
      type: "lead_created",
      outcome: "referral",
      note: "Lead created manually",
      created_by: "user-1"
    });
  });

  it("still succeeds if only the activity log write fails", async () => {
    insertLeadActivity.mockRejectedValueOnce(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await createManualLeadAction(input);
    expect(res.ok).toBe(true);
    spy.mockRestore();
  });

  it("is blocked during org preview", async () => {
    requireWritableOrgId.mockRejectedValue(
      new Error("Read-only preview — exit org preview to make changes.")
    );
    const res = await createManualLeadAction(input);
    expect(res).toEqual({
      ok: false,
      error: "Read-only preview — exit org preview to make changes."
    });
    expect(insertLead).not.toHaveBeenCalled();
  });

  it("returns field errors for missing name/phone without writing", async () => {
    const res = await createManualLeadAction({ ...input, name: "", phone: " " });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.fieldErrors).toMatchObject({
      name: "Name is required.",
      phone: "Phone is required."
    });
    expect(insertLead).not.toHaveBeenCalled();
  });

  it("rejects a duplicate phone with a specific message and existing id", async () => {
    getLeadByPhone.mockResolvedValue(makeLead({ id: "old-1", name: "Vaidik U" }));
    const res = await createManualLeadAction(input);
    expect(res).toMatchObject({
      ok: false,
      error: "A lead with this phone number already exists (Vaidik U).",
      existingLeadId: "old-1"
    });
    expect(insertLead).not.toHaveBeenCalled();
  });

  it("rejects a duplicate real email", async () => {
    getLeadByEmail.mockResolvedValue(makeLead({ id: "old-2", name: null }));
    const res = await createManualLeadAction({ ...input, email: "A@B.com" });
    expect(getLeadByEmail).toHaveBeenCalledWith("a@b.com", "org-1");
    expect(res).toMatchObject({
      ok: false,
      error: "A lead with this email already exists.",
      existingLeadId: "old-2"
    });
  });

  it("maps a unique-violation race to a clear message", async () => {
    insertLead.mockRejectedValue({ code: "23505" });
    const res = await createManualLeadAction(input);
    expect(res).toEqual({
      ok: false,
      error: "A lead with this email already exists in this org."
    });
  });
});
