import { describe, expect, it, vi } from "vitest";

const calls: Array<[string, ...unknown[]]> = [];

vi.mock("@/lib/db/supabaseAdmin", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "is", "not", "lte"]) {
    chain[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return chain;
    };
  }
  chain.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
    resolve({ data: [], error: null });
  return { supabaseAdmin: { from: () => chain } };
});
vi.mock("@/lib/db/lead_reminders", () => ({ listLeadIdsWithDueFollowUps: vi.fn() }));

import { listLeadsNeedingSlackNoBookingNudge } from "@/lib/db/leads";

describe("listLeadsNeedingSlackNoBookingNudge", () => {
  it("is scoped to one org and matches form- or setter-qualified leads with no booking", async () => {
    await listLeadsNeedingSlackNoBookingNudge("org-rma", 5);
    expect(calls).toContainEqual(["eq", "org_id", "org-rma"]);
    expect(calls).toContainEqual(["or", "form_qualified.eq.true,qualified.eq.true"]);
    expect(calls).toContainEqual(["is", "call_booked_at", null]);
    expect(calls.some(([m, col]) => m === "eq" && col === "qualified")).toBe(false);
  });
});
