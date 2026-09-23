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

describe("updateLead call_confirmed derivation", () => {
  beforeEach(() => {
    updatePayloads.length = 0;
  });

  it("setter verifying a booked lead marks it Qualified Call Booked", async () => {
    const lead = makeLead({
      qualified: true,
      call_booked_at: "2026-09-23T06:34:29.003Z",
      call_confirmed: null
    });
    const updated = await updateLead(lead, { setter_verified: true });
    expect(updated.call_confirmed).toBe(true);
    expect(updated.stage).toBe("qualified_call_booked");
  });

  it("booking after verification also confirms", async () => {
    const lead = makeLead({ setter_verified: true, call_booked_at: null });
    const updated = await updateLead(lead, {
      call_booked_at: "2026-09-23T06:34:29.003Z"
    });
    expect(updated.call_confirmed).toBe(true);
  });

  it("unverified booking stays Call Booked", async () => {
    const lead = makeLead({ call_booked_at: "2026-09-23T06:34:29.003Z" });
    const updated = await updateLead(lead, { notes: "x" });
    expect(updated.call_confirmed).toBeNull();
    expect(updated.stage).toBe("call_booked");
  });
});
