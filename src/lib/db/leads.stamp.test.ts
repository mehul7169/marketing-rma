import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLead } from "@/test/fixtures";

const updatePayloads: Record<string, unknown>[] = [];

vi.mock("@/lib/db/supabaseAdmin", () => {
  const chain = {
    update(payload: Record<string, unknown>) {
      updatePayloads.push(payload);
      return chain;
    },
    eq: () => chain,
    select: () => chain,
    single: async () => ({ data: updatePayloads[updatePayloads.length - 1], error: null })
  };
  return { supabaseAdmin: { from: () => chain } };
});
vi.mock("@/lib/db/lead_reminders", () => ({ listLeadIdsWithDueFollowUps: vi.fn() }));

import { updateLead } from "@/lib/db/leads";

describe("updateLead stamp", () => {
  beforeEach(() => {
    updatePayloads.length = 0;
  });

  it("writes stage from qualified + booked, not call_confirmed", async () => {
    const lead = makeLead({
      qualified: true,
      call_booked_at: "2026-09-23T06:34:29.003Z"
    });
    const updated = await updateLead(lead, { notes: "x" });
    expect(updated.stage).toBe("qualified_call_booked");
    expect(updatePayloads[0]).not.toHaveProperty("call_confirmed");
    expect(updatePayloads[0]).not.toHaveProperty("action_status");
    expect(updatePayloads[0]).not.toHaveProperty("lifecycle_status");
  });

  it("unqualified booking stays Call Booked", async () => {
    const lead = makeLead({ call_booked_at: "2026-09-23T06:34:29.003Z" });
    const updated = await updateLead(lead, { notes: "x" });
    expect(updated.stage).toBe("call_booked");
  });
});
