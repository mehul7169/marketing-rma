import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

export type WebsiteDailyRow = {
  date: string; // YYYY-MM-DD
  lead_source: string | null;
  utm_campaign: string | null;
  landing_page_visits: number | null;
  unique_visitors: number | null;
  video_plays: number | null;
  video_avg_watch_percent: number | null;
  video_completion_rate: number | null;
  form_starts: number | null;
  form_completions: number | null;
  created_at: string | null;
};

export type WebsiteTrendPoint = {
  date: string;
  landing_page_visits: number;
  video_plays: number;
};

export type WebsiteDailyTableRow = {
  date: string;
  landing_page_visits: number;
  unique_visitors: number;
  video_plays: number;
  video_avg_watch_percent: number | null;
  video_completion_rate: number | null;
  form_starts: number;
  form_completions: number;
};

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nullNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function deleteWebsiteDailySiteWideByDates(dates: string[]) {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  if (dates.length === 0) return;

  const { error } = await supabaseAdmin
    .from("website_daily")
    .delete()
    .in("date", dates)
    .is("lead_source", null)
    .is("utm_campaign", null);

  if (error) throw error;
}

export async function upsertWebsiteDaily(rows: Array<Partial<WebsiteDailyRow> & { date: string }>) {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  const payload = rows.map((r) => ({
    date: r.date,
    lead_source: r.lead_source ?? null,
    utm_campaign: r.utm_campaign ?? null,
    landing_page_visits: r.landing_page_visits ?? null,
    unique_visitors: r.unique_visitors ?? null,
    video_plays: r.video_plays ?? null,
    video_avg_watch_percent: r.video_avg_watch_percent ?? null,
    video_completion_rate: r.video_completion_rate ?? null,
    form_starts: r.form_starts ?? null,
    form_completions: r.form_completions ?? null
  }));

  const { error } = await supabaseAdmin
    .from("website_daily")
    .upsert(payload, {
      // Unique is (date, lead_source, utm_campaign). Note: Postgres treats NULLs as distinct,
      // so cron routes delete-and-reinsert for the site-wide (null/null) rows.
      onConflict: "date,lead_source,utm_campaign"
    });

  if (error) throw error;
}

export async function getWebsiteTrend(fromISO: string, toISO: string): Promise<WebsiteTrendPoint[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("website_daily")
    .select("date, landing_page_visits, video_plays")
    .is("lead_source", null)
    .is("utm_campaign", null)
    .gte("date", fromISO)
    .lte("date", toISO)
    .order("date", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  return (data as Array<{ date: string; landing_page_visits: unknown; video_plays: unknown }>).map((r) => ({
    date: r.date,
    landing_page_visits: num(r.landing_page_visits),
    video_plays: num(r.video_plays)
  }));
}

export async function getWebsiteDailyTable(
  fromISO: string,
  toISO: string
): Promise<WebsiteDailyTableRow[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("website_daily")
    .select(
      [
        "date",
        "landing_page_visits",
        "unique_visitors",
        "video_plays",
        "video_avg_watch_percent",
        "video_completion_rate",
        "form_starts",
        "form_completions"
      ].join(",")
    )
    .is("lead_source", null)
    .is("utm_campaign", null)
    .gte("date", fromISO)
    .lte("date", toISO)
    .order("date", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  const typed = data as unknown as Array<{
    date: string;
    landing_page_visits: unknown;
    unique_visitors: unknown;
    video_plays: unknown;
    video_avg_watch_percent: unknown;
    video_completion_rate: unknown;
    form_starts: unknown;
    form_completions: unknown;
  }>;

  return typed.map((r) => ({
    date: r.date,
    landing_page_visits: num(r.landing_page_visits),
    unique_visitors: num(r.unique_visitors),
    video_plays: num(r.video_plays),
    video_avg_watch_percent: nullNum(r.video_avg_watch_percent),
    video_completion_rate: nullNum(r.video_completion_rate),
    form_starts: num(r.form_starts),
    form_completions: num(r.form_completions)
  }));
}

export async function getWebsiteTotals(fromISO: string, toISO: string): Promise<{
  totalLandingPageVisits: number;
  totalVideoPlays: number;
  averageWatchPercent: number | null;
  formCompletionRatePercent: number | null;
}> {
  if (!supabaseAdmin) {
    return { totalLandingPageVisits: 0, totalVideoPlays: 0, averageWatchPercent: null, formCompletionRatePercent: null };
  }
  const rows = await getWebsiteDailyTable(fromISO, toISO);
  if (rows.length === 0) {
    return {
      totalLandingPageVisits: 0,
      totalVideoPlays: 0,
      averageWatchPercent: null,
      formCompletionRatePercent: null
    };
  }

  let totalLandingPageVisits = 0;
  let totalVideoPlays = 0;
  let watchNumerator = 0;
  let watchDenominator = 0;

  let formStarts = 0;
  let formCompletions = 0;

  for (const r of rows) {
    totalLandingPageVisits += r.landing_page_visits;
    totalVideoPlays += r.video_plays;
    if (r.video_avg_watch_percent !== null && r.video_plays > 0) {
      watchNumerator += r.video_avg_watch_percent * r.video_plays;
      watchDenominator += r.video_plays;
    }
    formStarts += r.form_starts;
    formCompletions += r.form_completions;
  }

  const averageWatchPercent =
    watchDenominator > 0 ? watchNumerator / watchDenominator : null;

  const formCompletionRatePercent =
    formStarts > 0 ? (formCompletions / formStarts) * 100 : null;

  return { totalLandingPageVisits, totalVideoPlays, averageWatchPercent, formCompletionRatePercent };
}

