import { describe, expect, it, vi } from "vitest";
import { makeLead } from "@/test/fixtures";

const updates: Record<string, unknown>[] = [];

vi.mock("@/lib/db/supabaseAdmin", () => {
  const chain: Record<string, unknown> = {};
  chain.update = (payload: Record<string, unknown>) => {
    updates.push(payload);
    return chain;
  };
  chain.eq = () => chain;
  chain.select = () => chain;
  chain.single = async () => ({ data: { ...updates[updates.length - 1] }, error: null });
  return { supabaseAdmin: { from: () => chain } };
});
vi.mock("@/lib/db/lead_reminders", () => ({ listLeadIdsWithDueFollowUps: vi.fn() }));

import { updateLead } from "@/lib/db/leads";

describe("updateLead", () => {
  it("never sends the generated pipeline_stage column", async () => {
    // Rows read with select * carry pipeline_stage; writing it back fails with 428C9.
    const existing = { ...makeLead({ id: "l1" }), pipeline_stage: "contacted" };
    await updateLead(existing, { notes: "hi" });
    const sent = updates[updates.length - 1];
    expect(sent).not.toHaveProperty("pipeline_stage");
    expect(sent.notes).toBe("hi");
  });
});
