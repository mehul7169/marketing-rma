import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/db/cron_runs";
import { getGa4IngestConfigFromEnv, ingestGa4Range } from "@/lib/ingest/ga4";
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
    // Deliberate simplification: GA4 property is RMA's only for now.
    const orgId = await getOrgIdBySlug("rma");
    const config = getGa4IngestConfigFromEnv();
    const rowsUpserted = await ingestGa4Range(
      config,
      yesterdayISO,
      todayISO,
      orgId
    );

    await logCronRun({
      job: "ga4",
      status: "success",
      rows_upserted: rowsUpserted,
      error: null
    });

    return NextResponse.json({ ok: true, rows: rowsUpserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCronRun({
      job: "ga4",
      status: "error",
      rows_upserted: null,
      error: msg
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
