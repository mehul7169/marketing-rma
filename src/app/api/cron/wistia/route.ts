import { NextRequest, NextResponse } from "next/server";
import { assertCronSecret } from "@/lib/utils/cronAuth";
import { logCronRun } from "@/lib/db/cron_runs";
import { deleteWebsiteDailySiteWideByDates, upsertWebsiteDaily } from "@/lib/db/website_daily";
import { addDaysISO, toISODate } from "@/lib/utils/date";

type WistiaAnalyticsResponse = {
  plays?: number | null;
  engagement_rate?: number | null; // 0..1
  cta_impressions?: number | null;
  form_conversions?: number | null;
};

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.WISTIA_API_TOKEN;
  const mediaId = process.env.WISTIA_MEDIA_ID;

  if (!token || !mediaId) {
    return NextResponse.json({ error: "Missing Wistia env vars" }, { status: 500 });
  }

  const todayISO = toISODate(new Date());
  const yesterdayISO = addDaysISO(todayISO, -1);
  const dates = [yesterdayISO, todayISO];

  const endpointBase = "https://api.wistia.com/modern";
  const apiVersion = "2026-07";

  try {
    const payloadRows: Array<{
      date: string;
      lead_source: null;
      utm_campaign: null;
      video_plays: number | null;
      video_avg_watch_percent: number | null;
      video_completion_rate: number | null;
      form_starts: number | null;
      form_completions: number | null;
    }> = [];

    for (const date of dates) {
      const res = await fetch(
        `${endpointBase}/analytics/medias/${encodeURIComponent(mediaId)}?start_date=${date}&end_date=${addDaysISO(date, 1)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Wistia-API-Version": apiVersion
          }
        }
      );

      const json = (await res.json()) as WistiaAnalyticsResponse;
      if (!res.ok) {
        throw new Error(
          `Wistia analytics error for ${date}: ${JSON.stringify(json).slice(0, 1000)}`
        );
      }

      const plays = numOrNull(json.plays);
      const engagementRate = json.engagement_rate;

      // Wistia gives average engagement rate as 0..1.
      const video_avg_watch_percent =
        engagementRate === null || engagementRate === undefined
          ? null
          : numOrNull((engagementRate as number) * 100);

      payloadRows.push({
        date,
        lead_source: null,
        utm_campaign: null,
        video_plays: plays,
        video_avg_watch_percent,
        video_completion_rate: null, // TODO: map Wistia completion metric when you confirm which endpoint/field you want.
        form_starts: numOrNull(json.cta_impressions),
        form_completions: numOrNull(json.form_conversions)
      });
    }

    await deleteWebsiteDailySiteWideByDates(dates);
    await upsertWebsiteDaily(payloadRows);

    await logCronRun({
      job: "wistia",
      status: "success",
      rows_upserted: payloadRows.length,
      error: null
    });

    return NextResponse.json({ ok: true, rows: payloadRows.length });
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

