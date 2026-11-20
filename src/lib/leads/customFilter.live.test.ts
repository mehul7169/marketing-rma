import "dotenv/config";
import { describe, expect, it } from "vitest";
import { countLeads } from "@/lib/db/leads";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import type { CustomFilter } from "@/lib/leads/customFilter";
import { jsonTextColumn } from "@/lib/leads/filterFields";
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

async function sqlCount(orgId: string, apply: (q: any) => any) {
  let q = supabaseAdmin!.from("leads").select("id", { count: "exact", head: true }).eq("org_id", orgId);
  q = apply(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

describe.skipIf(!hasDb)("custom filter vs live SQL (read-only)", () => {
  it("Work Queue Deal is Lost cannot surface showed leads", async () => {
    const orgId = await rmaOrgId();
    expect(orgId).toBeTruthy();
    const filter: CustomFilter = {
      match: "all",
      conditions: [{ id: "1", field: "deal", op: "is_any", value: ["lost"] }]
    };
    const filters = listFiltersForView({
      orgId,
      tabId: "all",
      filterId: null,
      search: "",
      showFormUnqualified: false,
      sort: "newest",
      customFilter: filter
    });
    expect(filters.dead).toBe("show");
    expect(filters.excludeShowed).toBe(true);
    const t0 = Date.now();
    const ui = await countLeads(filters);
    const ms = Date.now() - t0;
    const sqlAllLost = await sqlCount(orgId, (q) => q.eq("deal_closed", false));
    const sqlNotShowed = await sqlCount(orgId, (q) =>
      q.eq("deal_closed", false).or("call_showed.is.null,call_showed.eq.false")
    );
    const deadLost = await sqlCount(orgId, (q) => q.eq("deal_closed", false).eq("is_dead", true));
    console.log(
      `WQ Deal is Lost: ui=${ui} sqlAllLost=${sqlAllLost} sqlNotShowed=${sqlNotShowed} deadLost=${deadLost} ${ms}ms`
    );
    expect(ui).toBe(sqlNotShowed);
    expect(sqlAllLost).toBeGreaterThan(ui);
    expect(deadLost).toBeGreaterThan(0);
    expect(ms, "plain column filter should be well under 300ms at ~2k rows").toBeLessThan(2000);
  });

  it("/leads Deal is Lost still equals deal_closed = false, including dead leads", async () => {
    const orgId = await rmaOrgId();
    const filter: CustomFilter = {
      match: "all",
      conditions: [{ id: "1", field: "deal", op: "is_any", value: ["lost"] }]
    };
    const ui = await countLeads({ orgId, customFilter: filter });
    const sql = await sqlCount(orgId, (q) => q.eq("deal_closed", false));
    expect(ui).toBe(sql);
    expect(ui).toBeGreaterThan(0);
  });

  it("Form Qualified Yes AND Call booked at is not empty", async () => {
    const orgId = await rmaOrgId();
    const filter: CustomFilter = {
      match: "all",
      conditions: [
        { id: "1", field: "form_qualified", op: "is_yes" },
        { id: "2", field: "call_booked_at", op: "is_not_empty" }
      ]
    };
    const filters = listFiltersForView({
      orgId,
      tabId: "all",
      filterId: null,
      search: "",
      showFormUnqualified: false,
      sort: "newest",
      customFilter: filter
    });
    expect(filters.hideFormUnqualified).toBe(false);
    const t0 = Date.now();
    const ui = await countLeads({ orgId, dead: "show", customFilter: filter });
    const sql = await sqlCount(orgId, (q) =>
      q.eq("form_qualified", true).not("call_booked_at", "is", null)
    );
    console.log(`Form Qualified + booked: ui=${ui} sql=${sql} ${Date.now() - t0}ms`);
    expect(ui).toBe(sql);
  });

  it("Showed Up Yes AND post-call awaiting / contract_shared", async () => {
    const orgId = await rmaOrgId();
    const filter: CustomFilter = {
      match: "all",
      conditions: [
        { id: "1", field: "call_showed", op: "is_yes" },
        {
          id: "2",
          field: "post_call_status",
          op: "is_any",
          value: ["awaiting_lead_response", "contract_shared"]
        }
      ]
    };
    const ui = await countLeads(
      listFiltersForView({
        orgId,
        tabId: "all",
        filterId: null,
        search: "",
        showFormUnqualified: false,
        sort: "newest",
        customFilter: filter
      })
    );
    const sql = await sqlCount(orgId, (q) =>
      q.eq("call_showed", true).in("post_call_status", [
        "awaiting_lead_response",
        "contract_shared"
      ])
    );
    const onLeads = await countLeads({ orgId, customFilter: filter });
    console.log(`Showed + post-call: wq=${ui} sql=${sql} leads=${onLeads}`);
    expect(ui).toBe(0);
    expect(onLeads).toBe(sql);
  });

  it("form-answer monthly revenue contains 5000", async () => {
    const orgId = await rmaOrgId();
    const key = "what_is_your_current_monthly_revenue?";
    const filter: CustomFilter = {
      match: "all",
      conditions: [
        { id: "1", field: `custom_fields.${key}`, op: "contains", value: "5000" }
      ]
    };
    const ui = await countLeads({ orgId, dead: "show", customFilter: filter });
    const sql = await sqlCount(orgId, (q) => q.ilike(jsonTextColumn(key), "%5000%"));
    console.log(`Revenue contains 5000: ui=${ui} sql=${sql}`);
    expect(ui).toBe(sql);
  });

  it("Match any: Source is youtube OR Source is ig", async () => {
    const orgId = await rmaOrgId();
    const filter: CustomFilter = {
      match: "any",
      conditions: [
        { id: "1", field: "lead_source", op: "is_any", value: ["youtube"] },
        { id: "2", field: "lead_source", op: "is_any", value: ["ig"] }
      ]
    };
    const ui = await countLeads({ orgId, dead: "show", customFilter: filter });
    const sql = await sqlCount(orgId, (q) => q.in("lead_source", ["youtube", "ig"]));
    console.log(`Source youtube OR ig: ui=${ui} sql=${sql}`);
    expect(ui).toBe(sql);
    expect(ui).toBeGreaterThan(0);
  });
});
