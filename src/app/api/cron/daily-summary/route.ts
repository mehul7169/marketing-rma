import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/db/cron_runs";
import { getOrgIdBySlug } from "@/lib/orgs/getOrgIdBySlug";
import { buildDailySummaryMessage } from "@/lib/reports/dailySummary";
import { gatherDailySummary } from "@/lib/reports/gatherDailySummary";
import { postSlackWebhook } from "@/lib/slack/notify";
import { assertCronSecret } from "@/lib/utils/cronAuth";
import { todayISTDateString } from "@/lib/timezone";

export const runtime = "nodejs";

/**
 * 8:00 PM IST digest (vercel.json "30 14 * * *" — Vercel cron is UTC).
 * `?dry_run=1` returns the numbers + Block Kit payload without posting.
 */
export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry_run") === "1";
  const asOf = new Date();
  const dateISO = todayISTDateString();

  try {
    const orgId = await getOrgIdBySlug("rma");
    const data = await gatherDailySummary(orgId, dateISO, asOf);
    const message = buildDailySummaryMessage(data);

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, data, message });
    }

    const url = process.env.SLACK_DAILY_SUMMARY_WEBHOOK_URL;
    if (!url) throw new Error("Missing SLACK_DAILY_SUMMARY_WEBHOOK_URL");
    await postSlackWebhook(url, message.text, message.blocks);

    await logCronRun({ job: "daily-summary", status: "success", rows_upserted: null, error: null });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!dryRun) {
      await logCronRun({ job: "daily-summary", status: "error", rows_upserted: null, error: msg });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
