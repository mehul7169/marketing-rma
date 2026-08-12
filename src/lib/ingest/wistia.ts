import { addDaysISO } from "@/lib/utils/date";
import {
  mergeAndUpsertWebsiteDaily,
  type WebsiteDailyRow
} from "@/lib/db/website_daily";

export type WistiaAnalyticsResponse = {
  plays?: number | null;
  engagement_rate?: number | null;
  cta_impressions?: number | null;
  form_conversions?: number | null;
};

export type WistiaStatsByDateRow = {
  date: string;
  load_count?: number | null;
  play_count?: number | null;
  hours_watched?: number | null;
};

export type WistiaIngestConfig = {
  apiToken: string;
  mediaId: string;
};

const WISTIA_API_BASE = "https://api.wistia.com/modern";
const WISTIA_API_VERSION = "2026-07";

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function wistiaHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "X-Wistia-API-Version": WISTIA_API_VERSION
  };
}

/** Daily analytics for a single calendar day (matches hourly cron behavior). */
export async function fetchWistiaAnalyticsForDay(
  config: WistiaIngestConfig,
  dateISO: string
): Promise<WistiaAnalyticsResponse> {
  const endISO = addDaysISO(dateISO, 1);
  const res = await fetch(
    `${WISTIA_API_BASE}/analytics/medias/${encodeURIComponent(config.mediaId)}?start_date=${dateISO}&end_date=${endISO}`,
    { method: "GET", headers: wistiaHeaders(config.apiToken) }
  );

  const json = (await res.json()) as WistiaAnalyticsResponse & { error?: string };
  if (!res.ok) {
    throw new Error(
      `Wistia analytics error for ${dateISO}: ${json.error ?? JSON.stringify(json).slice(0, 1000)}`
    );
  }

  return json;
}

export function transformWistiaAnalyticsDay(
  dateISO: string,
  analytics: WistiaAnalyticsResponse
): Partial<WebsiteDailyRow> & { date: string } {
  const engagementRate = analytics.engagement_rate;
  const video_avg_watch_percent =
    engagementRate === null || engagementRate === undefined
      ? null
      : numOrNull(engagementRate * 100);

  return {
    date: dateISO,
    lead_source: null,
    utm_campaign: null,
    video_plays: numOrNull(analytics.plays),
    video_avg_watch_percent,
    video_completion_rate: null,
    form_starts: numOrNull(analytics.cta_impressions),
    form_completions: numOrNull(analytics.form_conversions)
  };
}

/**
 * Historical daily play counts via Stats API (by_date).
 * Does not include engagement_rate / form metrics per day.
 */
export async function fetchWistiaStatsByDateRange(
  config: WistiaIngestConfig,
  sinceISO: string,
  untilISO: string
): Promise<WistiaStatsByDateRow[]> {
  const url = new URL(
    `${WISTIA_API_BASE}/stats/medias/${encodeURIComponent(config.mediaId)}/by_date`
  );
  url.searchParams.set("start_date", sinceISO);
  url.searchParams.set("end_date", untilISO);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: wistiaHeaders(config.apiToken)
  });

  const json = (await res.json()) as WistiaStatsByDateRow[] | { error?: string };
  if (!res.ok) {
    throw new Error(
      `Wistia stats by_date error: ${typeof json === "object" && json && "error" in json ? json.error : JSON.stringify(json).slice(0, 1000)}`
    );
  }

  if (!Array.isArray(json)) {
    throw new Error("Wistia stats by_date returned unexpected response shape");
  }

  return json;
}

export function transformWistiaStatsByDateRows(
  rows: WistiaStatsByDateRow[]
): Array<Partial<WebsiteDailyRow> & { date: string }> {
  return rows
    .filter((row) => row.date)
    .map((row) => ({
      date: row.date,
      lead_source: null,
      utm_campaign: null,
      video_plays: numOrNull(row.play_count)
    }));
}

/** Incremental cron: last 2 days via per-day Analytics API. */
export async function ingestWistiaRecentDays(
  config: WistiaIngestConfig,
  dates: string[]
): Promise<number> {
  const payload: Array<Partial<WebsiteDailyRow> & { date: string }> = [];

  for (const date of dates) {
    const analytics = await fetchWistiaAnalyticsForDay(config, date);
    payload.push(transformWistiaAnalyticsDay(date, analytics));
  }

  if (payload.length > 0) {
    await mergeAndUpsertWebsiteDaily(payload);
  }

  return payload.length;
}

export type WistiaBackfillResult = {
  rowsUpserted: number;
  dailyPlayCountsAvailable: boolean;
  engagementPerDayAvailable: boolean;
  note?: string;
};

/**
 * Historical backfill: daily play counts from Stats by_date.
 * Engagement / form metrics are not available historically at daily granularity
 * via the same endpoints used by the hourly cron.
 */
export async function ingestWistiaHistoricalRange(
  config: WistiaIngestConfig,
  sinceISO: string,
  untilISO: string
): Promise<WistiaBackfillResult> {
  let rows: WistiaStatsByDateRow[];

  try {
    rows = await fetchWistiaStatsByDateRange(config, sinceISO, untilISO);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      rowsUpserted: 0,
      dailyPlayCountsAvailable: false,
      engagementPerDayAvailable: false,
      note:
        `Wistia does not provide historical daily breakdown via this endpoint — only current aggregate stats are available going forward from today. (${message})`
    };
  }

  if (rows.length === 0) {
    return {
      rowsUpserted: 0,
      dailyPlayCountsAvailable: false,
      engagementPerDayAvailable: false,
      note:
        "Wistia stats by_date returned no rows for this range. Daily play counts may not be available for this media or date range."
    };
  }

  const payload = transformWistiaStatsByDateRows(rows);
  if (payload.length > 0) {
    await mergeAndUpsertWebsiteDaily(payload);
  }

  return {
    rowsUpserted: payload.length,
    dailyPlayCountsAvailable: true,
    engagementPerDayAvailable: false,
    note:
      "Historical daily video_plays backfilled from Wistia Stats by_date. Average watch % and form metrics are only populated by the hourly cron going forward (Analytics API, per-day)."
  };
}

export function getWistiaIngestConfigFromEnv(): WistiaIngestConfig {
  const apiToken = process.env.WISTIA_API_TOKEN;
  const mediaId = process.env.WISTIA_MEDIA_ID;

  if (!apiToken || !mediaId) {
    throw new Error("Missing WISTIA_API_TOKEN or WISTIA_MEDIA_ID");
  }

  return { apiToken, mediaId };
}
