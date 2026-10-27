import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeLead } from "@/test/fixtures";
import type { LeadRow } from "@/lib/leads/types";

const getLeadByEmail = vi.fn();
const insertLead = vi.fn();
const updateLead = vi.fn();

vi.mock("@/lib/db/leads", () => ({
  getLeadByEmail: (...a: unknown[]) => getLeadByEmail(...a),
  insertLead: (...a: unknown[]) => insertLead(...a),
  updateLead: (...a: unknown[]) => updateLead(...a)
}));
vi.mock("@/lib/orgs/getOrgIdBySlug", () => ({ getOrgIdBySlug: async () => "org-rma" }));
vi.mock("@/lib/slack/messages", () => ({ notifySlackNewLead: vi.fn() }));
vi.mock("@/lib/utils/ingestAuth", () => ({ assertWebsiteIngestSecret: () => undefined }));

import { POST } from "@/app/api/ingest/lead-form/route";

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/ingest/lead-form", {
      method: "POST",
      body: JSON.stringify(body)
    })
  );
}

describe("POST /api/ingest/lead-form qualification", () => {
  beforeEach(() => {
    getLeadByEmail.mockReset();
    insertLead.mockReset().mockImplementation(async (row: Partial<LeadRow>) => makeLead(row));
    updateLead
      .mockReset()
      .mockImplementation(async (lead: LeadRow, patch: Partial<LeadRow>) => ({ ...lead, ...patch }));
  });

  it("new lead: stores the form verdict in form_qualified only", async () => {
    getLeadByEmail.mockResolvedValue(null);
    await post({ email: "A@x.com", qualified: true });
    const row = insertLead.mock.calls[0]![0] as Partial<LeadRow>;
    expect(row.form_qualified).toBe(true);
    expect(row).not.toHaveProperty("qualified");
    expect(row).not.toHaveProperty("qualified_at");
    expect(row).not.toHaveProperty("qualified_by");
  });

  it("new lead without a verdict leaves form_qualified null", async () => {
    getLeadByEmail.mockResolvedValue(null);
    await post({ email: "b@x.com" });
    expect((insertLead.mock.calls[0]![0] as Partial<LeadRow>).form_qualified).toBeNull();
  });

  it("existing lead: updates form_qualified and never touches the setter decision", async () => {
    getLeadByEmail.mockResolvedValue(
      makeLead({ qualified: false, qualified_by: "setter@x.com", form_qualified: null, slack_form_notified: true })
    );
    await post({ email: "c@x.com", qualified: true });
    const patch = updateLead.mock.calls[0]![1] as Partial<LeadRow>;
    expect(patch.form_qualified).toBe(true);
    expect(patch).not.toHaveProperty("qualified");
    expect(patch).not.toHaveProperty("qualified_by");
  });

  it("existing lead: a resubmission without a verdict keeps the old form answer", async () => {
    getLeadByEmail.mockResolvedValue(makeLead({ form_qualified: false, slack_form_notified: true }));
    await post({ email: "d@x.com", name: "D" });
    expect((updateLead.mock.calls[0]![1] as Partial<LeadRow>).form_qualified).toBe(false);
  });
});
