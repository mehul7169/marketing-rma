import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLead } from "@/test/fixtures";

const insertLeadActivity = vi.fn();
const getLeadById = vi.fn();
const updateLead = vi.fn();

vi.mock("@/lib/db/lead_activities", () => ({
  insertLeadActivity: (...args: unknown[]) => insertLeadActivity(...args)
}));

vi.mock("@/lib/db/leads", () => ({
  getLeadById: (...args: unknown[]) => getLeadById(...args),
  updateLead: (...args: unknown[]) => updateLead(...args)
}));

import {
  logCallAttempt,
  reviveDeadLead
} from "@/lib/leads/lifecycleCadence";

describe("logCallAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateLead.mockImplementation(async (_lead, patch) =>
      makeLead({ ..._lead, ...patch })
    );
  });

  it("increments contact_attempts and sets next_action_at on no_answer", async () => {
    const lead = makeLead({ contact_attempts: 0 });
    getLeadById.mockResolvedValue(lead);

    await logCallAttempt(lead.id, lead.org_id, "no_answer");

    expect(insertLeadActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "call_attempt",
        outcome: "no_answer"
      })
    );
    expect(updateLead).toHaveBeenCalledWith(
      lead,
      expect.objectContaining({
        contact_attempts: 1,
        next_action_at: expect.any(String),
        is_dead: false,
        last_action: "Called — No Answer"
      })
    );
  });

  it("marks dead on 3rd no_answer", async () => {
    const lead = makeLead({ contact_attempts: 2 });
    getLeadById.mockResolvedValue(lead);

    await logCallAttempt(lead.id, lead.org_id, "no_answer");

    expect(updateLead).toHaveBeenCalledWith(
      lead,
      expect.objectContaining({
        contact_attempts: 3,
        is_dead: true,
        dead_reason: "no answer after 3 touchpoints",
        next_action_at: null
      })
    );
  });

  it("qualified requires scheduledFor and books + confirms in one motion", async () => {
    const lead = makeLead({
      lead_source: "website",
      contact_attempts: 2,
      call_booked_at: null
    });
    getLeadById.mockResolvedValue(lead);

    await expect(
      logCallAttempt(lead.id, lead.org_id, "qualified")
    ).rejects.toThrow("scheduledFor is required");

    await logCallAttempt(lead.id, lead.org_id, "qualified", {
      scheduledFor: "2026-06-15T10:00:00.000Z"
    });

    expect(updateLead).toHaveBeenCalledWith(
      lead,
      expect.objectContaining({
        qualified: true,
        call_booked_at: expect.any(String),
        call_scheduled_for: "2026-06-15T10:00:00.000Z",
        call_confirmed: true,
        contact_attempts: 0,
        next_action_at: null,
        action_status: "Qualified Call Booked"
      })
    );
  });

  it("qualified on already-booked lead keeps original call_booked_at", async () => {
    const bookedAt = "2026-01-01T00:00:00.000Z";
    const lead = makeLead({
      call_booked_at: bookedAt,
      contact_attempts: 1
    });
    getLeadById.mockResolvedValue(lead);

    await logCallAttempt(lead.id, lead.org_id, "qualified", {
      scheduledFor: "2026-06-20T12:00:00.000Z"
    });

    expect(updateLead).toHaveBeenCalledWith(
      lead,
      expect.objectContaining({
        qualified: true,
        call_booked_at: bookedAt,
        call_scheduled_for: "2026-06-20T12:00:00.000Z",
        call_confirmed: true,
        contact_attempts: 0,
        action_status: "Qualified Call Booked"
      })
    );
  });

  it("not_qualified marks dead with qualification dead_reason", async () => {
    const lead = makeLead({
      call_booked_at: "2026-01-01T00:00:00.000Z"
    });
    getLeadById.mockResolvedValue(lead);

    await logCallAttempt(lead.id, lead.org_id, "not_qualified");

    expect(updateLead).toHaveBeenCalledWith(
      lead,
      expect.objectContaining({
        qualified: false,
        is_dead: true,
        dead_reason: "reached lead, confirmed not qualified",
        next_action_at: null
      })
    );
  });
});

describe("reviveDeadLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateLead.mockImplementation(async (_lead, patch) =>
      makeLead({ ..._lead, ...patch })
    );
  });

  it("resets dead fields without deleting activities", async () => {
    const lead = makeLead({
      is_dead: true,
      dead_reason: "no answer after 3 touchpoints",
      contact_attempts: 3,
      next_action_at: "2026-01-02T00:00:00.000Z"
    });
    getLeadById.mockResolvedValue(lead);

    await reviveDeadLead(lead.id, lead.org_id, { note: "came back" });

    expect(insertLeadActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "revive", note: "came back" })
    );
    expect(insertLeadActivity).toHaveBeenCalledTimes(1);
    expect(updateLead).toHaveBeenCalledWith(
      lead,
      expect.objectContaining({
        is_dead: false,
        dead_reason: null,
        contact_attempts: 0,
        next_action_at: null,
        action_status: "Untouched"
      })
    );
  });

  it("throws when lead is not dead", async () => {
    getLeadById.mockResolvedValue(makeLead({ is_dead: false }));
    await expect(reviveDeadLead("lead-1", "org-1")).rejects.toThrow(
      "Lead is not dead"
    );
  });
});
