import { NextRequest, NextResponse } from "next/server";
import { assertCronSecret } from "@/lib/utils/cronAuth";
import { logCronRun } from "@/lib/db/cron_runs";
import { deleteWebsiteDailySiteWideByDates, upsertWebsiteDaily } from "@/lib/db/website_daily";
import { addDaysISO, toISODate } from "@/lib/utils/date";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

export const runtime = "nodejs";

type GA4MetricValue = { value: string };
type GA4Row = {
  dimensionValues: Array<{ value: string }>;
  metricValues: GA4MetricValue[];
};

export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = process.env.GA4_PROPERTY_ID;
  const serviceAccountJson = process.env.GA4_SERVICE_ACCOUNT_JSON;

  if (!propertyId || !serviceAccountJson) {
    return NextResponse.json({ error: "Missing GA4 env vars" }, { status: 500 });
  }

  const todayISO = toISODate(new Date());
  const yesterdayISO = addDaysISO(todayISO, -1);

  try {
    const serviceAccount = JSON.parse(serviceAccountJson) as Record<string, unknown>;
    const client = new BetaAnalyticsDataClient({
      credentials: serviceAccount as never
    });

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: yesterdayISO, endDate: todayISO }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      limit: 10000
    });

    const rows = (response?.rows ?? []) as GA4Row[];

    const dateToValues = new Map<
      string,
      { sessions: number; totalUsers: number }
    >();

    for (const r of rows) {
      const date = r.dimensionValues?.[0]?.value;
      if (!date) continue;
      const sessions = Number(r.metricValues?.[0]?.value ?? "0");
      const totalUsers = Number(r.metricValues?.[1]?.value ?? "0");
      dateToValues.set(date, { sessions, totalUsers });
    }

    const dates = Array.from(dateToValues.keys());
    await deleteWebsiteDailySiteWideByDates(dates);

    const payload = dates.map((date) => ({
      date,
      lead_source: null,
      utm_campaign: null,
      landing_page_visits: dateToValues.get(date)?.sessions ?? null,
      unique_visitors: dateToValues.get(date)?.totalUsers ?? null
    }));

    await upsertWebsiteDaily(payload);

    await logCronRun({
      job: "ga4",
      status: "success",
      rows_upserted: payload.length,
      error: null
    });

    return NextResponse.json({ ok: true, rows: payload.length });
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

