import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLead } from "@/test/fixtures";

const insertLeadActivity = vi.fn();
const getLeadById = vi.fn();
const updateLead = vi.fn();
const scheduleLeadCall = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/getCurrentOrgId", () => ({
  requireWritableOrgId: async () => "org-1"
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
  scheduleLeadCall: (...args: unknown[]) => scheduleLeadCall(...args)
}));

import { saveLeadActions, saveLeadSchedule } from "@/app/leads/actions";

beforeEach(() => {
  vi.clearAllMocks();
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
