import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEAL_ERRORS } from "@/lib/deals/dealLifecycle";
import { makeLead } from "@/test/fixtures";

const getLeadById = vi.fn();
const commitLeadChange = vi.fn();
const requireWritableOrgId = vi.fn();
const listMembershipsForOrg = vi.fn();

vi.mock("@/lib/auth/getCurrentOrgId", () => ({
  requireWritableOrgId: () => requireWritableOrgId()
}));
vi.mock("@/lib/db/leads", () => ({
  getLeadById: (...a: unknown[]) => getLeadById(...a),
  commitLeadChange: (...a: unknown[]) => commitLeadChange(...a)
}));
vi.mock("@/lib/db/memberships", () => ({
  listMembershipsForOrg: (...a: unknown[]) => listMembershipsForOrg(...a)
}));

import { updateDeal } from "@/lib/deals/updateDeal";

const actor = { userId: "u1", email: "closer@x.com" };
const ownerId = "22222222-2222-2222-2222-222222222222";
const next = {
  next_step: "Call about pricing",
  next_action_at: "2099-11-22T09:30:00.000Z"
};

beforeEach(() => {
  vi.clearAllMocks();
  requireWritableOrgId.mockResolvedValue("org-1");
  commitLeadChange.mockImplementation(async (lead, patch) => makeLead({ ...lead, ...patch }));
  listMembershipsForOrg.mockResolvedValue([
    { user_id: ownerId, status: "active" }
  ]);
});

describe("updateDeal", () => {
  it("checks the org first and writes nothing during preview", async () => {
    requireWritableOrgId.mockRejectedValue(new Error("Read-only preview"));
    await expect(updateDeal("l1", "set_value", { value: 1 }, actor)).rejects.toThrow(
      "Read-only preview"
    );
    expect(getLeadById).not.toHaveBeenCalled();
    expect(commitLeadChange).not.toHaveBeenCalled();
  });

  it("validation failure writes neither the lead nor an activity", async () => {
    getLeadById.mockResolvedValue(makeLead({ call_showed: true }));
    const res = await updateDeal("l1", "log_follow_up", { outcome: "spoke" }, actor);
    expect(res).toEqual({ ok: false, error: DEAL_ERRORS.nextStepRequired });
    expect(commitLeadChange).not.toHaveBeenCalled();
  });

  it("commits patch + activities together, stamped with the actor", async () => {
    const lead = makeLead({ call_showed: true });
    getLeadById.mockResolvedValue(lead);
    const res = await updateDeal("l1", "log_follow_up", { outcome: "spoke", ...next }, actor);
    expect(res.ok).toBe(true);
    const [sentLead, patch, activities] = commitLeadChange.mock.calls[0];
    expect(sentLead).toBe(lead);
    expect(patch).toMatchObject({ next_step: "Call about pricing" });
    expect(activities).toEqual([
      {
        type: "deal_follow_up",
        outcome: "spoke",
        note: null,
        next_action_at: next.next_action_at,
        created_by: "u1"
      }
    ]);
  });

  it("assign_owner rejects a non-member without writing", async () => {
    getLeadById.mockResolvedValue(makeLead({ call_showed: true }));
    listMembershipsForOrg.mockResolvedValue([]);
    const res = await updateDeal("l1", "assign_owner", { ownerId }, actor);
    expect(res).toEqual({ ok: false, error: DEAL_ERRORS.ownerNotMember });
    expect(commitLeadChange).not.toHaveBeenCalled();
  });
});
