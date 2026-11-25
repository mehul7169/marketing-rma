import { NextRequest, NextResponse } from "next/server";
import {
  ADSPEND_JOB,
  adspendRunNotes,
  buildAdspendSlackText,
  syncAdspendSheet
} from "@/lib/adspend/sync";
import { cronAlertWebhookUrl } from "@/lib/cron/reportCronResult";
import { logCronRun } from "@/lib/db/cron_runs";
import { postSlackWebhook } from "@/lib/slack/notify";
import { assertCronSecret } from "@/lib/utils/cronAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 07:30 IST (vercel.json "0 2 * * *" — Vercel cron is UTC).
 * Writes yesterday + the previous 2 days of Meta spend to the Master AdSpend sheet.
 * `?dry_run=1` inspects without writing or logging. `?from=&to=` override the window.
 */
export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry_run") === "1";
  const fromISO = req.nextUrl.searchParams.get("from")?.trim() || undefined;
  const toISO = req.nextUrl.searchParams.get("to")?.trim() || undefined;

  try {
    const result = await syncAdspendSheet({ fromISO, toISO, dryRun });
    const accountErrors = result.accounts
      .filter((a) => a.status === "error")
      .map((a) => `${a.client}: ${a.error}`)
      .join(" | ");

    if (!dryRun) {
      await logCronRun({
        job: ADSPEND_JOB,
        status: result.ok ? "success" : "error",
        rows_upserted: result.rowsUpserted,
        error: result.ok ? accountErrors || null : result.error ?? adspendRunNotes(result)
      });
      const slack = buildAdspendSlackText(result);
      const webhook = cronAlertWebhookUrl();
      if (result.ok && slack && webhook) {
        try {
          await postSlackWebhook(webhook, slack);
        } catch (e) {
          console.error("adspend-sheet slack summary failed", e);
        }
      }
    }

    if (!result.ok) {
      return NextResponse.json({ ...result, ok: false }, { status: 500 });
    }
    return NextResponse.json({ ...result, ok: true, dryRun });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!dryRun) {
      await logCronRun({
        job: ADSPEND_JOB,
        status: "error",
        rows_upserted: null,
        error: msg
      });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
