import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { insertLead, countLeads } from "@/lib/db/leads";
import { listLeadActivities } from "@/lib/db/lead_activities";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { applyLeadLifecycle } from "@/lib/leads/updateLeadLifecycle";
import { listFiltersForView } from "@/lib/leads/workQueueParams";
import { findOrgIdBySlug } from "@/lib/orgs/getOrgIdBySlug";
import { todayISTDateString } from "@/lib/timezone";

const hasDb =
  process.env.LIVE_DB === "1" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function rmaOrgId(): Promise<string> {
  return (
    (await findOrgIdBySlug("rma")) ??
    (await findOrgIdBySlug("rma-marketing")) ??
    ""
  );
}

async function deleteLead(leadId: string, orgId: string) {
  await supabaseAdmin!.from("lead_activities").delete().eq("lead_id", leadId).eq("org_id", orgId);
  await supabaseAdmin!.from("leads").delete().eq("id", leadId).eq("org_id", orgId);
}

describe.skipIf(!hasDb)("cancel booking live", () => {
  let createdId: string | null = null;
  let orgId = "";

  afterAll(async () => {
    if (createdId && orgId) await deleteLead(createdId, orgId);
  });

  it("book → cancel not_qualified drops Meetings Booked and Calls Booked", async () => {
    orgId = await rmaOrgId();
    expect(orgId).toBeTruthy();
    const { data: profile, error: profileError } = await supabaseAdmin!
      .from("profiles")
      .select("id, email")
      .eq("email", process.env.TEST_ADMIN_EMAIL ?? "test-admin@runmoreads.in")
      .single();
    if (profileError) throw profileError;
    const actor = { userId: profile!.id as string, email: profile!.email as string };

    const stamp = Date.now();
    const email = `cancel-booking-${stamp}@manual.invalid`;
    const lead = await insertLead({
      org_id: orgId,
      email,
      name: "Cancel booking live",
      form_qualified: true
    });
    createdId = lead.id;

    const booked = await applyLeadLifecycle(
      lead,
      "log_call_attempt",
      {
        outcome: "qualified",
        scheduledFor: new Date(Date.now() + 86400000).toISOString()
      },
      actor
    );
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const meetings = listFiltersForView({
      orgId,
      tabId: "meetings_booked",
      filterId: null,
      search: email,
      showFormUnqualified: false,
      sort: "newest"
    });
    const today = todayISTDateString();
    expect(await countLeads(meetings)).toBe(1);
    expect(
      await countLeads({ orgId, kpi: "calls_booked", fromISO: today, toISO: today, search: email })
    ).toBe(1);

    const beforeAttempts = (await listLeadActivities(lead.id, orgId)).filter(
      (a) => a.type === "call_attempt"
    ).length;

    const cancelled = await applyLeadLifecycle(
      booked.lead,
      "cancel_booking",
      { reason: "not_qualified" },
      actor
    );
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.lead.call_booked_at).toBeNull();
    expect(cancelled.lead.is_dead).toBe(true);
    expect(cancelled.lead.dead_reason).toBe("not_qualified");
    expect(await countLeads(meetings)).toBe(0);
    expect(
      await countLeads({ orgId, kpi: "calls_booked", fromISO: today, toISO: today, search: email })
    ).toBe(0);

    const activities = await listLeadActivities(lead.id, orgId);
    const types = activities.map((a) => `${a.type}/${a.outcome}`);
    expect(types.filter((t) => t === "call_cancelled/not_qualified")).toHaveLength(1);
    expect(types.filter((t) => t === "qualification/unqualified")).toHaveLength(1);
    expect(activities.filter((a) => a.type === "call_attempt")).toHaveLength(beforeAttempts);

    const bookedAgain = await applyLeadLifecycle(
      cancelled.lead,
      "book_call",
      { scheduledFor: new Date(Date.now() + 2 * 86400000).toISOString() },
      actor
    );
    expect(bookedAgain.ok).toBe(true);
    if (!bookedAgain.ok) return;
    expect(bookedAgain.lead.call_booked_at).toBeTruthy();
  });
});
