import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { applyDeal } from "@/lib/deals/updateDeal";
import { countLeads, insertLead } from "@/lib/db/leads";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { applyLeadLifecycle } from "@/lib/leads/updateLeadLifecycle";
import { listFiltersForView } from "@/lib/leads/workQueueParams";
import { findOrgIdBySlug } from "@/lib/orgs/getOrgIdBySlug";

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

async function activityCount(leadId: string, orgId: string): Promise<number> {
  const { count, error } = await supabaseAdmin!
    .from("lead_activities")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("lead_id", leadId);
  if (error) throw error;
  return count ?? 0;
}

async function deleteLead(leadId: string, orgId: string) {
  await supabaseAdmin!.from("lead_activities").delete().eq("lead_id", leadId).eq("org_id", orgId);
  await supabaseAdmin!.from("leads").delete().eq("id", leadId).eq("org_id", orgId);
}

describe.skipIf(!hasDb)("deals 1 of 3 live checks", () => {
  let createdId: string | null = null;
  let orgId = "";

  afterAll(async () => {
    if (createdId && orgId) await deleteLead(createdId, orgId);
  });

  it("Work Queue All drops showed leads; /leads and won/lost stay put", async () => {
    orgId = await rmaOrgId();
    expect(orgId).toBeTruthy();
    const wqAll = listFiltersForView({
      orgId,
      tabId: "all",
      filterId: null,
      search: "",
      showFormUnqualified: false,
      sort: "newest"
    });
    const wqBefore = await countLeads({ ...wqAll, excludeShowed: false });
    const wqAfter = await countLeads(wqAll);
    const showedInWq = await countLeads({ ...wqAll, excludeShowed: false, customFilter: {
      match: "all",
      conditions: [{ id: "s", field: "call_showed", op: "is_yes" }]
    }});
    const leadsTotal = await countLeads({ orgId });
    const won = await countLeads({ orgId, kpi: "deals_closed" });
    const { count: lost } = await supabaseAdmin!
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("deal_closed", false);
    console.log(
      JSON.stringify({
        wqBefore,
        showedInWq,
        wqAfter,
        drop: wqBefore - wqAfter,
        leadsTotal,
        won,
        lost
      })
    );
    expect(wqAll.excludeShowed).toBe(true);
    expect(wqBefore - wqAfter).toBe(showedInWq);
    expect(wqAfter).toBe(wqBefore - showedInWq);
    expect(leadsTotal).toBeGreaterThan(wqBefore);
    expect(won).toBe(13);
  });

  it("fake RMA lead: showed → owner, follow-up/lost validation, won then cleanup", async () => {
    orgId = await rmaOrgId();
    const { data: profile, error: profileError } = await supabaseAdmin!
      .from("profiles")
      .select("id, email")
      .eq("email", process.env.TEST_ADMIN_EMAIL ?? "test-admin@runmoreads.in")
      .single();
    if (profileError) throw profileError;
    const actor = { userId: profile!.id as string, email: profile!.email as string };

    const stamp = Date.now();
    const lead = await insertLead({
      org_id: orgId,
      email: `deals-p1-${stamp}@manual.invalid`,
      name: "Deals 1 of 3 test",
      form_qualified: true,
      call_booked_at: new Date().toISOString(),
      call_scheduled_for: new Date(Date.now() + 86400000).toISOString()
    });
    createdId = lead.id;

    const wq = listFiltersForView({
      orgId,
      tabId: "all",
      filterId: null,
      search: `deals-p1-${stamp}`,
      showFormUnqualified: false,
      sort: "newest"
    });
    expect(await countLeads(wq)).toBe(1);

    const showed = await applyLeadLifecycle(lead, "mark_showed", {}, actor);
    expect(showed.ok).toBe(true);
    if (!showed.ok) return;
    expect(showed.lead.owner_id).toBe(actor.userId);
    expect(showed.lead.call_showed).toBe(true);
    expect(await countLeads(wq)).toBe(0);

    const beforeFollow = await activityCount(lead.id, orgId);
    const rejectedFollow = await applyDeal(showed.lead, "log_follow_up", { outcome: "spoke" }, actor);
    expect(rejectedFollow.ok).toBe(false);
    expect(await activityCount(lead.id, orgId)).toBe(beforeFollow);

    const next = {
      next_step: "Call about pricing",
      next_action_at: new Date(Date.now() + 2 * 86400000).toISOString()
    };
    const followed = await applyDeal(
      showed.lead,
      "log_follow_up",
      { outcome: "spoke", note: "live check", ...next },
      actor
    );
    expect(followed.ok).toBe(true);
    if (!followed.ok) return;
    expect(followed.lead.next_step).toBe("Call about pricing");
    expect(new Date(followed.lead.next_action_at!).toISOString()).toBe(
      new Date(next.next_action_at).toISOString()
    );
    expect(await activityCount(lead.id, orgId)).toBe(beforeFollow + 1);

    const beforeLost = await activityCount(lead.id, orgId);
    const rejectedLost = await applyDeal(followed.lead, "mark_lost", {}, actor);
    expect(rejectedLost.ok).toBe(false);
    expect(await activityCount(lead.id, orgId)).toBe(beforeLost);

    const wonBefore = await countLeads({ orgId, kpi: "deals_closed" });
    const won = await applyDeal(followed.lead, "mark_won", { value: 1 }, actor);
    expect(won.ok).toBe(true);
    if (!won.ok) return;
    expect(won.lead.deal_closed).toBe(true);
    expect(await countLeads({ orgId, kpi: "deals_closed" })).toBe(wonBefore + 1);

    await deleteLead(lead.id, orgId);
    createdId = null;
    expect(await countLeads({ orgId, kpi: "deals_closed" })).toBe(wonBefore);
  });
});
