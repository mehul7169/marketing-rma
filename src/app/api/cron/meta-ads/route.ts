import { NextRequest, NextResponse } from "next/server";
import { assertCronSecret } from "@/lib/utils/cronAuth";
import { logCronRun } from "@/lib/db/cron_runs";
import { upsertMetaAdsDaily } from "@/lib/db/meta_ads_daily";
import { addDaysISO, toISODate } from "@/lib/utils/date";

type MetaAction = { action_type: string; value: string };
type MetaCostPerAction = { action_type: string; value: string };

type MetaInsightsRow = {
  date_start: string; // YYYY-MM-DD
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string;
  adset_name: string | null;
  spend: string | null;
  impressions: string | null;
  reach: string | null;
  cpm: string | null;
  clicks: string | null;
  ctr: string | null;
  cpc: string | null;
  actions: MetaAction[] | null;
  cost_per_action_type: MetaCostPerAction[] | null;
};

function numOrNull(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractLeads(actions: MetaAction[] | null): number | null {
  if (!actions || actions.length === 0) return null;
  const leadAction = actions.find((a) => {
    const t = a.action_type.toLowerCase();
    return t === "lead" || t.includes("lead");
  });
  if (!leadAction) return null;
  const n = Number(leadAction.value);
  return Number.isFinite(n) ? n : null;
}

function extractCostPerLead(costPerAction: MetaCostPerAction[] | null): number | null {
  if (!costPerAction || costPerAction.length === 0) return null;
  const leadCPA = costPerAction.find((a) => a.action_type.toLowerCase().includes("lead"));
  if (!leadCPA) return null;
  const n = Number(leadCPA.value);
  return Number.isFinite(n) ? n : null;
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch (e) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.META_ACCESS_TOKEN;
  const accountIdRaw = process.env.META_AD_ACCOUNT_ID;
  const metaAppId = process.env.META_APP_ID;
  const metaAppSecret = process.env.META_APP_SECRET;

  if (!token || !accountIdRaw) {
    return NextResponse.json({ error: "Missing Meta env vars" }, { status: 500 });
  }
  // App-scoped auth is optional here because you asked for a long-lived access token.
  void metaAppId;
  void metaAppSecret;

  const todayISO = toISODate(new Date());
  const yesterdayISO = addDaysISO(todayISO, -1);

  const actId = accountIdRaw.startsWith("act_") ? accountIdRaw : `act_${accountIdRaw}`;
  const endpoint = `https://graph.facebook.com/v19.0/${actId}/insights`;

  const params = new URLSearchParams({
    access_token: token,
    level: "adset",
    time_increment: "1",
    time_range: JSON.stringify({ since: yesterdayISO, until: todayISO }),
    fields: [
      "date_start",
      "campaign_id",
      "campaign_name",
      "adset_id",
      "adset_name",
      "spend",
      "impressions",
      "reach",
      "cpm",
      "clicks",
      "ctr",
      "cpc",
      "actions",
      "cost_per_action_type"
    ].join(",")
  });

  const rows: MetaInsightsRow[] = [];
  let url: string | null = `${endpoint}?${params.toString()}`;

  for (let i = 0; i < 10 && url; i++) {
    const res = await fetch(url, { method: "GET" });
    const json = (await res.json()) as { data?: MetaInsightsRow[]; paging?: { next?: string } };
    if (!res.ok) {
      throw new Error(`Meta insights error: ${JSON.stringify(json).slice(0, 1000)}`);
    }
    if (json.data) rows.push(...json.data);
    url = json.paging?.next ?? null;
  }

  const payload = rows
    .filter((r) => r.adset_id && r.date_start)
    .map((r) => {
      const leads = extractLeads(r.actions);
      const costPerLead = extractCostPerLead(r.cost_per_action_type);

      const spend = numOrNull(r.spend);
      const clicks = numOrNull(r.clicks);

      const computedCostPerLead = spend !== null && leads && leads > 0 ? spend / leads : null;
      const computedLpConversionRate =
        leads !== null && clicks !== null && clicks > 0 ? leads / clicks : null;

      return {
        date: r.date_start,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        ad_set_id: r.adset_id,
        ad_set_name: r.adset_name,
        utm_term: null,
        spend,
        impressions: numOrNull(r.impressions),
        reach: numOrNull(r.reach),
        cpm: numOrNull(r.cpm),
        clicks,
        ctr: numOrNull(r.ctr),
        cpc: numOrNull(r.cpc),
        leads_meta_reported: leads,
        cost_per_lead: costPerLead ?? computedCostPerLead,
        lp_conversion_rate: computedLpConversionRate
      };
    });

  try {
    await upsertMetaAdsDaily(payload);
    await logCronRun({
      job: "meta-ads",
      status: "success",
      rows_upserted: payload.length,
      error: null
    });

    return NextResponse.json({ ok: true, rows: payload.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCronRun({
      job: "meta-ads",
      status: "error",
      rows_upserted: payload.length,
      error: msg
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

