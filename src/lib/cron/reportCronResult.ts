/**
 * After each cron_runs write: alert Slack when a job starts failing, at most
 * once per 24h while it stays down, then one recovery message.
 * Daily jobs (daily-summary, deals-digest, adspend-sheet) alert on the first failure;
 * everything else waits for 3 consecutive errors.
 */

import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import type { CronRunLog } from "@/lib/db/cron_runs";
import { postSlackWebhook } from "@/lib/slack/notify";
import { formatIST } from "@/lib/timezone";

export const DAILY_CRON_JOBS = new Set(["daily-summary", "deals-digest", "adspend-sheet"]);
export const HOURLY_FAIL_STREAK = 3;
export const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const APP_BASE = "https://tracking.runmoreads.in";
const ERROR_CLIP = 300;
const RUNS_PAGE = 200;
const RUNS_MAX_PAGES = 25;

export type CronRunSnapshot = {
  status: "success" | "error";
  error: string | null;
  ran_at: string;
};

export type CronAlertState = {
  job: string;
  failing_since: string;
  last_alert_at: string;
};

export type CronAlertAction = "none" | "failure" | "recovery";

export type CronAlertDecision = {
  action: CronAlertAction;
  text: string | null;
  streak: number;
  failingSince: string | null;
  lastError: string | null;
};

export type CronAlertDeps = {
  now: Date;
  listRuns: (job: string) => Promise<CronRunSnapshot[]>;
  getState: (job: string) => Promise<CronAlertState | null>;
  upsertState: (row: CronAlertState) => Promise<void>;
  deleteState: (job: string) => Promise<void>;
  post: (text: string) => Promise<void>;
};

const SETTINGS_PATH: Record<string, string> = {
  "meta-ads": "/meta-ads",
  ga4: "/website",
  wistia: "/website"
};

export function failureThreshold(job: string): number {
  return DAILY_CRON_JOBS.has(job) ? 1 : HOURLY_FAIL_STREAK;
}

export function isMetaTokenExpiry(error: string | null | undefined): boolean {
  if (!error) return false;
  return (
    error.includes("Error validating access token") ||
    error.includes("Session has expired")
  );
}

export function clipError(error: string | null | undefined, max = ERROR_CLIP): string {
  const t = (error ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : t.slice(0, max);
}

export function failureStreak(runsNewestFirst: CronRunSnapshot[]): {
  count: number;
  failingSince: string | null;
  lastError: string | null;
} {
  let count = 0;
  let lastError: string | null = null;
  let failingSince: string | null = null;
  for (const run of runsNewestFirst) {
    if (run.status !== "error") break;
    count += 1;
    if (!lastError && run.error) lastError = run.error;
    failingSince = run.ran_at;
  }
  return { count, failingSince, lastError };
}

export function cronSettingsUrl(job: string): string | null {
  const path = SETTINGS_PATH[job];
  return path ? `${APP_BASE}${path}` : null;
}

export function buildCronFailureAlert(opts: {
  job: string;
  streak: number;
  failingSince: string;
  lastError: string | null;
}): string {
  const when = formatIST(opts.failingSince, "HH:mm");
  const times =
    opts.streak === 1
      ? `${opts.job} has failed since ${when} IST`
      : `${opts.job} has failed ${opts.streak} times in a row since ${when} IST`;
  const token = isMetaTokenExpiry(opts.lastError)
    ? " Meta access token expired. Reconnect with a long-lived token."
    : opts.lastError
      ? ` Last error: ${clipError(opts.lastError)}`
      : "";
  let text = `⚠️ ${times}.${token}`;
  const href = cronSettingsUrl(opts.job);
  if (href) {
    const label = opts.job === "meta-ads" ? "Open Meta Ads" : "Open settings";
    text += `\n<${href}|${label}>`;
  }
  return text;
}

export function buildCronRecoveryAlert(job: string): string {
  return `✅ ${job} recovered`;
}

export function decideCronAlert(opts: {
  job: string;
  result: Pick<CronRunLog, "status" | "error">;
  runsNewestFirst: CronRunSnapshot[];
  state: CronAlertState | null;
  now: Date;
}): CronAlertDecision {
  if (opts.result.status === "success") {
    if (!opts.state) {
      return { action: "none", text: null, streak: 0, failingSince: null, lastError: null };
    }
    return {
      action: "recovery",
      text: buildCronRecoveryAlert(opts.job),
      streak: 0,
      failingSince: opts.state.failing_since,
      lastError: null
    };
  }

  const streak = failureStreak(opts.runsNewestFirst);
  const threshold = failureThreshold(opts.job);
  if (streak.count < threshold || !streak.failingSince) {
    return {
      action: "none",
      text: null,
      streak: streak.count,
      failingSince: streak.failingSince,
      lastError: streak.lastError
    };
  }

  const failingSince = opts.state?.failing_since ?? streak.failingSince;
  if (opts.state?.last_alert_at) {
    const elapsed = opts.now.getTime() - Date.parse(opts.state.last_alert_at);
    if (Number.isFinite(elapsed) && elapsed < ALERT_COOLDOWN_MS) {
      return {
        action: "none",
        text: null,
        streak: streak.count,
        failingSince,
        lastError: streak.lastError
      };
    }
  }

  return {
    action: "failure",
    text: buildCronFailureAlert({
      job: opts.job,
      streak: streak.count,
      failingSince,
      lastError: streak.lastError ?? opts.result.error
    }),
    streak: streak.count,
    failingSince,
    lastError: streak.lastError ?? opts.result.error
  };
}

export async function listCronRunsNewestFirst(job: string): Promise<CronRunSnapshot[]> {
  if (!supabaseAdmin) return [];
  const out: CronRunSnapshot[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("cron_runs")
      .select("status, error, ran_at")
      .eq("job", job)
      .order("ran_at", { ascending: false })
      .range(offset, offset + RUNS_PAGE - 1);
    if (error) throw error;
    const page = (data ?? []).map((row) => {
      const r = row as { status: string; error: string | null; ran_at: string };
      return {
        status: r.status === "error" ? ("error" as const) : ("success" as const),
        error: r.error ?? null,
        ran_at: String(r.ran_at)
      };
    });
    out.push(...page);
    if (page.length < RUNS_PAGE) break;
    if (out.some((r) => r.status === "success")) break;
    offset += RUNS_PAGE;
    if (offset >= RUNS_PAGE * RUNS_MAX_PAGES) break;
  }
  return out;
}

async function getAlertState(job: string): Promise<CronAlertState | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("cron_alert_state")
    .select("job, failing_since, last_alert_at")
    .eq("job", job)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    job: String(data.job),
    failing_since: String(data.failing_since),
    last_alert_at: String(data.last_alert_at)
  };
}

async function upsertAlertState(row: CronAlertState): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from("cron_alert_state").upsert(
    {
      job: row.job,
      failing_since: row.failing_since,
      last_alert_at: row.last_alert_at
    },
    { onConflict: "job" }
  );
  if (error) throw error;
}

async function deleteAlertState(job: string): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from("cron_alert_state").delete().eq("job", job);
  if (error) throw error;
}

export function cronAlertWebhookUrl(): string | null {
  return process.env.SLACK_DAILY_SUMMARY_WEBHOOK_URL?.trim() || null;
}

async function postCronAlert(text: string): Promise<void> {
  const url = cronAlertWebhookUrl();
  if (!url) {
    console.error("cron alert skipped: SLACK_DAILY_SUMMARY_WEBHOOK_URL is not set");
    return;
  }
  await postSlackWebhook(url, text, [
    { type: "section", text: { type: "mrkdwn", text } }
  ]);
}

export function defaultCronAlertDeps(now: Date = new Date()): CronAlertDeps {
  return {
    now,
    listRuns: listCronRunsNewestFirst,
    getState: getAlertState,
    upsertState: upsertAlertState,
    deleteState: deleteAlertState,
    post: postCronAlert
  };
}

/** Inspect a job from cron_runs without posting or writing alert state. */
export async function inspectCronFailure(
  job: string,
  now: Date = new Date()
): Promise<CronAlertDecision & { latest: CronRunSnapshot | null }> {
  const runs = await listCronRunsNewestFirst(job);
  const latest = runs[0] ?? null;
  const result: Pick<CronRunLog, "status" | "error"> = latest
    ? { status: latest.status, error: latest.error }
    : { status: "success", error: null };
  const decision = decideCronAlert({
    job,
    result,
    runsNewestFirst: runs,
    state: null,
    now
  });
  return { ...decision, latest };
}

/**
 * Call after writing cron_runs. Never throws — a Slack/table miss must not
 * fail the ingest.
 */
export async function reportCronResult(
  job: string,
  result: Pick<CronRunLog, "status" | "error">,
  deps: CronAlertDeps = defaultCronAlertDeps()
): Promise<CronAlertDecision> {
  try {
    const [runs, state] = await Promise.all([
      result.status === "error" ? deps.listRuns(job) : Promise.resolve([]),
      deps.getState(job)
    ]);
    const decision = decideCronAlert({
      job,
      result,
      runsNewestFirst: runs,
      state,
      now: deps.now
    });
    if (decision.action === "none" || !decision.text) return decision;
    await deps.post(decision.text);
    const iso = deps.now.toISOString();
    if (decision.action === "recovery") {
      await deps.deleteState(job);
    } else if (decision.failingSince) {
      await deps.upsertState({
        job,
        failing_since: decision.failingSince,
        last_alert_at: iso
      });
    }
    return decision;
  } catch (e) {
    console.error("reportCronResult failed", e);
    return {
      action: "none",
      text: null,
      streak: 0,
      failingSince: null,
      lastError: result.error ?? null
    };
  }
}
