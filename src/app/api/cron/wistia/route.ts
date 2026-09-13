import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/db/cron_runs";
import {
  getWistiaIngestConfigFromEnv,
  ingestWistiaRecentDays
} from "@/lib/ingest/wistia";
import { getOrgIdBySlug } from "@/lib/orgs/getOrgIdBySlug";
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
    // Deliberate simplification: Wistia media is RMA's only for now.
    const orgId = await getOrgIdBySlug("rma");
    const config = getWistiaIngestConfigFromEnv();
    const rowsUpserted = await ingestWistiaRecentDays(
      config,
      [yesterdayISO, todayISO],
      orgId
    );

    await logCronRun({
      job: "wistia",
      status: "success",
      rows_upserted: rowsUpserted,
      error: null
    });

    return NextResponse.json({ ok: true, rows: rowsUpserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCronRun({
      job: "wistia",
      status: "error",
      rows_upserted: null,
      error: msg
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
