import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeLead } from "@/test/fixtures";
import type { LeadRow } from "@/lib/leads/types";

const getLeadByEmail = vi.fn();
const insertLead = vi.fn();
const updateLead = vi.fn();
const commitLeadChange = vi.fn();
const insertLeadActivity = vi.fn();

vi.mock("@/lib/db/leads", () => ({
  getLeadByEmail: (...a: unknown[]) => getLeadByEmail(...a),
  getLeadById: vi.fn(),
  insertLead: (...a: unknown[]) => insertLead(...a),
  updateLead: (...a: unknown[]) => updateLead(...a),
  commitLeadChange: (...a: unknown[]) => commitLeadChange(...a)
}));
vi.mock("@/lib/db/lead_activities", () => ({
  insertLeadActivity: (...a: unknown[]) => insertLeadActivity(...a)
}));
vi.mock("@/lib/auth/getCurrentOrgId", () => ({ requireWritableOrgId: vi.fn() }));
vi.mock("@/lib/orgs/getOrgIdBySlug", () => ({ getOrgIdBySlug: async () => "org-rma" }));
vi.mock("@/lib/slack/messages", () => ({ notifySlackCallBooked: vi.fn() }));
vi.mock("@/lib/utils/ingestAuth", () => ({ assertWebsiteIngestSecret: () => undefined }));

import { POST } from "@/app/api/ingest/booking/route";

const body = {
  email: "a@x.com",
  cal_com_booking_id: "cal-1",
  call_scheduled_for: "2026-10-29T10:00:00.000Z"
};

function post() {
  return POST(
    new NextRequest("http://localhost/api/ingest/booking", {
      method: "POST",
      body: JSON.stringify(body)
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  insertLead.mockImplementation(async (row: Partial<LeadRow>) => makeLead({ ...row, id: "new-1" }));
  updateLead.mockImplementation(async (lead: LeadRow, patch: Partial<LeadRow>) => ({ ...lead, ...patch }));
  commitLeadChange.mockImplementation(async (lead: LeadRow, patch: Partial<LeadRow>) => ({ ...lead, ...patch }));
});

describe("POST /api/ingest/booking", () => {
  it("first booking on an uncontacted lead books (ingestion exception) and logs schedule atomically", async () => {
    getLeadByEmail.mockResolvedValue(makeLead({ first_contacted_at: null, call_booked_at: null }));
    const res = await post();
    expect(res.status).toBe(200);
    const [, patch, activities] = commitLeadChange.mock.calls[0];
    expect(patch).toMatchObject({
      call_scheduled_for: body.call_scheduled_for,
      cal_com_booking_id: "cal-1",
      booking_source: "cal_com"
    });
    expect(patch.call_booked_at).toBeTruthy();
    expect(activities).toEqual([{ type: "schedule", outcome: null, note: null, created_by: null }]);
  });

  it("already booked: updates the time without logging a reschedule", async () => {
    getLeadByEmail.mockResolvedValue(
      makeLead({ call_booked_at: "2026-10-20T10:00:00.000Z", slack_booking_notified: true })
    );
    await post();
    expect(commitLeadChange).not.toHaveBeenCalled();
    expect(insertLeadActivity).not.toHaveBeenCalled();
    expect(updateLead.mock.calls[0][1]).toMatchObject({ call_scheduled_for: body.call_scheduled_for });
    expect(updateLead.mock.calls[0][1]).not.toHaveProperty("call_booked_at");
  });

  it("booking with no prior lead creates it and logs schedule", async () => {
    getLeadByEmail.mockResolvedValue(null);
    await post();
    expect(insertLeadActivity).toHaveBeenCalledWith({
      org_id: "org-rma",
      lead_id: "new-1",
      type: "schedule"
    });
  });
});
