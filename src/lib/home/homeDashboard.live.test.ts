import "dotenv/config";
import { describe, expect, it } from "vitest";
import { assembleHomeDashboard } from "@/lib/home/assemble";
import { countKpis, filterTraffic, wonRevenue } from "@/lib/home/metrics";
import { istMonthEnd, istMonthStart, rangeToFromTo } from "@/lib/home/range";
import { listHomeLeads } from "@/lib/db/homeDashboard";
import { parseMonthlyTarget } from "@/lib/db/organizations";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { KPI_DEFINITIONS, type KpiKey } from "@/lib/leads/lifecycleDefinitions";
import { findOrgIdBySlug } from "@/lib/orgs/getOrgIdBySlug";
import {
  istDayEndUtcIso,
  istDayStartUtcIso,
  todayISTDateString
} from "@/lib/timezone";

const hasDb =
  process.env.LIVE_DB === "1" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function orgRow(where: { slug?: string; name?: string }) {
  let q = supabaseAdmin!.from("organizations").select("id, name, slug, monthly_target");
  if (where.slug) q = q.eq("slug", where.slug);
  if (where.name) q = q.eq("name", where.name);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    name: string;
    slug: string;
    monthly_target: unknown;
  } | null;
}

async function sqlKpiCount(
  orgId: string,
  kpi: KpiKey,
  fromISO: string,
  toISO: string
): Promise<number> {
  const def = KPI_DEFINITIONS[kpi];
  let q = supabaseAdmin!
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte(def.field, istDayStartUtcIso(fromISO))
    .lte(def.field, istDayEndUtcIso(toISO))
    .not(def.field, "is", null);
  for (const flag of def.requireTrue) q = q.eq(flag, true);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function sqlWonRevenue(
  orgId: string,
  fromISO: string,
  toISO: string
): Promise<number> {
  const { data, error } = await supabaseAdmin!
    .from("leads")
    .select("deal_value")
    .eq("org_id", orgId)
    .eq("deal_closed", true)
    .gte("closed_at", istDayStartUtcIso(fromISO))
    .lte("closed_at", istDayEndUtcIso(toISO));
  if (error) throw error;
  return (data ?? []).reduce(
    (s, r) => s + (r.deal_value == null ? 0 : Number(r.deal_value)),
    0
  );
}

describe.skipIf(!hasDb)("Home dashboard live checks", () => {
  it("matches SQL for RMA 30D KPIs and November revenue; hides goal for other orgs", async () => {
    const rmaId =
      (await findOrgIdBySlug("rma")) ?? (await findOrgIdBySlug("rma-marketing"));
    expect(rmaId).toBeTruthy();
    const rmaOrg = await orgRow({ slug: "rma" }) ??
      (await supabaseAdmin!
        .from("organizations")
        .select("id, name, slug, monthly_target")
        .eq("id", rmaId!)
        .maybeSingle()).data;
    expect(rmaOrg).toBeTruthy();

    const todayISO = todayISTDateString();
    const { fromISO, toISO } = rangeToFromTo("30d", todayISO);
    const monthStart = istMonthStart(todayISO);
    const monthEnd = istMonthEnd(todayISO);
    const leads = await listHomeLeads(rmaId!);
    const ui = countKpis(leads, fromISO, toISO);
    const uiPaid = countKpis(filterTraffic(leads, "paid"), fromISO, toISO).leads;
    const sql: Record<string, number> = {};
    for (const kpi of [
      "leads",
      "contacted",
      "qualified",
      "calls_booked",
      "showups",
      "deals_closed"
    ] as KpiKey[]) {
      sql[kpi] = await sqlKpiCount(rmaId!, kpi, fromISO, toISO);
    }
    const uiWonRev = wonRevenue(leads, fromISO, toISO).revenue;
    const sqlWonRev = await sqlWonRevenue(rmaId!, fromISO, toISO);
    const novUi = wonRevenue(leads, monthStart, monthEnd);
    const novSql = await sqlWonRevenue(rmaId!, monthStart, monthEnd);

    const dash = assembleHomeDashboard({
      leads,
      range: "30d",
      traffic: "all",
      todayISO,
      monthStart,
      monthEnd,
      monthlyTarget: parseMonthlyTarget(rmaOrg!.monthly_target),
      setters: [],
      closerLabels: new Map(),
      ads: null
    });

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          range: { fromISO, toISO, todayISO },
          table: [
            { metric: "Leads", ui: ui.leads, sql: sql.leads, paidUi: uiPaid },
            { metric: "Contacted", ui: ui.contacted, sql: sql.contacted },
            { metric: "Qualified", ui: ui.qualified, sql: sql.qualified },
            { metric: "Calls booked", ui: ui.calls_booked, sql: sql.calls_booked },
            { metric: "Showed", ui: ui.showups, sql: sql.showups },
            {
              metric: "Won",
              ui: ui.deals_closed,
              sql: sql.deals_closed,
              uiRev: uiWonRev,
              sqlRev: sqlWonRev
            },
            {
              metric: "November revenue",
              ui: novUi.revenue,
              sql: novSql,
              won: novUi.won
            }
          ]
        },
        null,
        2
      )
    );

    expect(ui.leads).toBe(sql.leads);
    expect(ui.contacted).toBe(sql.contacted);
    expect(ui.qualified).toBe(sql.qualified);
    expect(ui.calls_booked).toBe(sql.calls_booked);
    expect(ui.showups).toBe(sql.showups);
    expect(ui.deals_closed).toBe(sql.deals_closed);
    expect(uiWonRev).toBe(sqlWonRev);
    expect(novUi.revenue).toBe(novSql);
    expect(dash.goal).not.toBeNull();
    expect(dash.goal?.revenue).toBe(novSql);

    for (const name of ["Experto Labs", "Shah Nishant"]) {
      const org = await orgRow({ name });
      expect(org, name).toBeTruthy();
      expect(parseMonthlyTarget(org!.monthly_target)).toBeNull();
      const other = assembleHomeDashboard({
        leads: await listHomeLeads(org!.id),
        range: "30d",
        traffic: "all",
        todayISO,
        monthStart,
        monthEnd,
        monthlyTarget: parseMonthlyTarget(org!.monthly_target),
        setters: [],
        closerLabels: new Map(),
        ads: null
      });
      expect(other.goal, name).toBeNull();
    }
  }, 60_000);
});
