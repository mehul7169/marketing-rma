import { getLatestCronRunForJob } from "@/lib/db/cron_runs";
import { countLeads } from "@/lib/db/leads";
import { getMetaAdsTotals } from "@/lib/db/meta_ads_daily";
import { getSetterActivityReport } from "@/lib/db/setterActivity";
import type { DailySummaryData } from "@/lib/reports/dailySummary";

/**
 * Same queries as the pages the numbers are checked against:
 * setter = /insights Setter activity, spend = /meta-ads totals,
 * leads = /leads?lifecycle=all, calls booked = /leads?event=call_booked.
 */
export async function gatherDailySummary(
  orgId: string,
  dateISO: string,
  asOf: Date
): Promise<DailySummaryData> {
  const [setter, totals, leadsReceived, callsBooked, metaRun] = await Promise.all([
    getSetterActivityReport(orgId, dateISO, dateISO),
    getMetaAdsTotals(dateISO, dateISO, orgId),
    countLeads({ orgId, fromISO: dateISO, toISO: dateISO }),
    countLeads({ orgId, fromISO: dateISO, toISO: dateISO, event: "call_booked" }),
    getLatestCronRunForJob("meta-ads")
  ]);
  return {
    dateISO,
    asOf,
    setter,
    adSpend: totals.totalSpend,
    leadsReceived,
    callsBooked,
    metaLastRun: metaRun ? { ranAt: metaRun.ran_at, ok: metaRun.status === "success" } : null
  };
}
