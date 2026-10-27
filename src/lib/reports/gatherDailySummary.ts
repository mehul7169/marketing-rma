import { getLatestCronRunForJob } from "@/lib/db/cron_runs";
import { countLeads } from "@/lib/db/leads";
import { getMetaAdsTotals } from "@/lib/db/meta_ads_daily";
import { getSetterActivityReport } from "@/lib/db/setterActivity";
import type { DailySummaryData } from "@/lib/reports/dailySummary";

/**
 * Same queries as the pages the numbers are checked against:
 * setter = /insights Setter activity, spend = /meta-ads totals,
 * leads / calls booked / showups = the lifecycleDefinitions KPIs (same as
 * /leads?kpi=… and the Home funnel).
 */
export async function gatherDailySummary(
  orgId: string,
  dateISO: string,
  asOf: Date
): Promise<DailySummaryData> {
  const day = { orgId, fromISO: dateISO, toISO: dateISO };
  const [setter, totals, leadsReceived, callsBooked, showups, metaRun] = await Promise.all([
    getSetterActivityReport(orgId, dateISO, dateISO),
    getMetaAdsTotals(dateISO, dateISO, orgId),
    countLeads({ ...day, kpi: "leads" }),
    countLeads({ ...day, kpi: "calls_booked" }),
    countLeads({ ...day, kpi: "showups" }),
    getLatestCronRunForJob("meta-ads")
  ]);
  return {
    dateISO,
    asOf,
    setter,
    adSpend: totals.totalSpend,
    leadsReceived,
    callsBooked,
    showups,
    metaLastRun: metaRun ? { ranAt: metaRun.ran_at, ok: metaRun.status === "success" } : null
  };
}
