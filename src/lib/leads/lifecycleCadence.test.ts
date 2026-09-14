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

  it("qualified + bookAndConfirm sets qualified, booked, confirmed together", async () => {
    const lead = makeLead({
      lead_source: "quickform",
      contact_attempts: 2
    });
    getLeadById.mockResolvedValue(lead);

    await logCallAttempt(lead.id, lead.org_id, "qualified", {
      bookAndConfirm: true
    });

    expect(updateLead).toHaveBeenCalledWith(
      lead,
      expect.objectContaining({
        qualified: true,
        call_booked_at: expect.any(String),
        call_confirmed: true,
        contact_attempts: 0,
        next_action_at: null
      })
    );
  });

  it("qualified on an already-booked lead sets call_confirmed (Qualify Call path)", async () => {
    const lead = makeLead({
      call_booked_at: "2026-01-01T00:00:00.000Z",
      contact_attempts: 1
    });
    getLeadById.mockResolvedValue(lead);

    await logCallAttempt(lead.id, lead.org_id, "qualified");

    expect(updateLead).toHaveBeenCalledWith(
      lead,
      expect.objectContaining({
        qualified: true,
        call_confirmed: true,
        contact_attempts: 0,
        next_action_at: null
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
    // Only insert + update — never a delete on lead_activities
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
