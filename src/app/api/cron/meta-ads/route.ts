import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/db/cron_runs";
import { ingestMetaAdsForActiveAccounts } from "@/lib/ingest/meta";
import { assertCronSecret } from "@/lib/utils/cronAuth";
import { addDaysISO } from "@/lib/utils/date";
import { todayISTDateString } from "@/lib/timezone";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pull window is yesterday + today in IST, not UTC.
  const todayISO = todayISTDateString();
  const yesterdayISO = addDaysISO(todayISO, -1);

  try {
    const summary = await ingestMetaAdsForActiveAccounts(yesterdayISO, todayISO);

    const failureNotes = summary.results
      .filter((r) => r.error)
      .map((r) => `${r.clientName}: ${r.error}`)
      .join(" | ");

    // Partial success is still a successful cron run — one client must not
    // fail the job for everyone else.
    const status =
      summary.accountsSucceeded > 0 || summary.accountsAttempted === 0
        ? "success"
        : "error";

    await logCronRun({
      job: "meta-ads",
      status,
      rows_upserted: summary.rowsUpserted,
      error: failureNotes || null
    });

    if (status === "error") {
      return NextResponse.json(
        {
          ok: false,
          error: failureNotes || "All ad accounts failed",
          ...summary
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCronRun({
      job: "meta-ads",
      status: "error",
      rows_upserted: null,
      error: msg
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
