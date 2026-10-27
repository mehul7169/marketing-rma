import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLead } from "@/test/fixtures";

const updates: Record<string, unknown>[] = [];
const rpcCalls: Array<[string, Record<string, unknown>]> = [];

vi.mock("@/lib/db/supabaseAdmin", () => {
  const chain: Record<string, unknown> = {};
  chain.update = (payload: Record<string, unknown>) => {
    updates.push(payload);
    return chain;
  };
  chain.eq = () => chain;
  chain.select = () => chain;
  chain.single = async () => ({ data: { ...updates[updates.length - 1] }, error: null });
  const rpcChain = { single: async () => ({ data: { id: "l1" }, error: null }) };
  return {
    supabaseAdmin: {
      from: () => chain,
      rpc: (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        return rpcChain;
      }
    }
  };
});
vi.mock("@/lib/db/lead_reminders", () => ({ listLeadIdsWithDueFollowUps: vi.fn() }));

import { commitLeadChange, updateLead } from "@/lib/db/leads";

beforeEach(() => {
  updates.length = 0;
  rpcCalls.length = 0;
});

describe("updateLead", () => {
  it("never sends the generated pipeline_stage column", async () => {
    // Rows read with select * carry pipeline_stage; writing it back fails with 428C9.
    const existing = makeLead({ id: "l1", pipeline_stage: "contacted" });
    await updateLead(existing, { notes: "hi" });
    expect(updates[0]).not.toHaveProperty("pipeline_stage");
    expect(updates[0].notes).toBe("hi");
  });

  it("sends only changed columns", async () => {
    const existing = makeLead({ id: "l1", notes: "same", name: "Ann" });
    await updateLead(existing, { notes: "same", name: "Bea" });
    const sent = updates[0];
    expect(sent.name).toBe("Bea");
    expect(sent).not.toHaveProperty("notes");
    expect(sent).not.toHaveProperty("email");
    expect(sent).not.toHaveProperty("id");
    expect(sent).toHaveProperty("updated_at");
  });

  it("lets an explicit qualified_at / call_showed_at in the patch win", async () => {
    const existing = makeLead({
      id: "l1",
      qualified: true,
      qualified_at: "2026-01-01T00:00:00.000Z",
      call_showed: true,
      call_showed_at: "2026-01-02T00:00:00.000Z"
    });
    await updateLead(existing, {
      qualified: false,
      qualified_at: "2026-10-27T00:00:00.000Z",
      call_showed: false,
      call_showed_at: null
    });
    expect(updates[0].qualified_at).toBe("2026-10-27T00:00:00.000Z");
    expect(updates[0].call_showed_at).toBeNull();
  });
});

describe("commitLeadChange", () => {
  it("sends the changed columns and activities to apply_lead_change in one call", async () => {
    const existing = makeLead({ id: "l1", org_id: "o1", pipeline_stage: "new" });
    await commitLeadChange(existing, { notes: "x" }, [
      { type: "field_edited", note: "notes", created_by: "u1" }
    ]);
    expect(updates).toHaveLength(0);
    const [name, args] = rpcCalls[0];
    expect(name).toBe("apply_lead_change");
    expect(args.p_lead_id).toBe("l1");
    expect(args.p_org_id).toBe("o1");
    expect(args.p_patch).toMatchObject({ notes: "x" });
    expect(args.p_patch).not.toHaveProperty("pipeline_stage");
    expect(args.p_activities).toEqual([
      { type: "field_edited", outcome: null, note: "notes", next_action_at: null, created_by: "u1" }
    ]);
  });
});
