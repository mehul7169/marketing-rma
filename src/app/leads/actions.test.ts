import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLead } from "@/test/fixtures";

const insertLeadActivity = vi.fn();
const getLeadById = vi.fn();
const updateLead = vi.fn();
const scheduleLeadCall = vi.fn();
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
  scheduleLeadCall: (...args: unknown[]) => scheduleLeadCall(...args),
  getLeadByEmail: (...args: unknown[]) => getLeadByEmail(...args),
  getLeadByPhone: (...args: unknown[]) => getLeadByPhone(...args),
  insertLead: (...args: unknown[]) => insertLead(...args)
}));

import {
  createManualLeadAction,
  saveLeadActions,
  saveLeadSchedule
} from "@/app/leads/actions";

beforeEach(() => {
  vi.clearAllMocks();
  requireWritableOrgId.mockResolvedValue("org-1");
  getLeadByEmail.mockResolvedValue(null);
  getLeadByPhone.mockResolvedValue(null);
  insertLead.mockImplementation(async (row) => makeLead({ ...row, id: "new-1" }));
  updateLead.mockImplementation(async (lead, patch) => makeLead({ ...lead, ...patch }));
  scheduleLeadCall.mockImplementation(async (lead, iso, _by, extra) =>
    makeLead({ ...lead, ...extra, call_scheduled_for: iso })
  );
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

    expect(insertLeadActivity).toHaveBeenCalledTimes(1);
    expect(insertLeadActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: "org-1",
        lead_id: lead.id,
        type: "deal_outcome",
        outcome: "won",
        created_by: "user-1"
      })
    );
    const patch = updateLead.mock.calls[0][1];
    expect(patch.last_action).toBe("Deal won");
    expect(patch.last_action_at > lead.last_action_at!).toBe(true);
  });

  it("leaves last_action alone for non-milestone edits", async () => {
    const lead = makeLead({ last_action: "Called — No Answer" });
    getLeadById.mockResolvedValue(lead);

    await saveLeadActions(lead.id, { notes: "hello", reminder_sent: true });

    expect(insertLeadActivity).not.toHaveBeenCalled();
    expect(updateLead.mock.calls[0][1]).not.toHaveProperty("last_action");
  });
});

describe("saveLeadSchedule", () => {
  it("logs schedule for first booking and reschedule afterwards", async () => {
    getLeadById.mockResolvedValue(makeLead({ call_scheduled_for: null }));
    await saveLeadSchedule("lead-1", "2026-09-25T10:00");
    expect(insertLeadActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "schedule" })
    );
    expect(scheduleLeadCall.mock.calls[0][3]).toMatchObject({
      last_action: "Call scheduled"
    });

    getLeadById.mockResolvedValue(
      makeLead({ call_scheduled_for: "2026-09-25T04:30:00.000Z" })
    );
    await saveLeadSchedule("lead-1", "2026-09-26T10:00");
    expect(insertLeadActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "reschedule" })
    );
    expect(scheduleLeadCall.mock.calls[1][3]).toMatchObject({
      last_action: "Call rescheduled"
    });
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
