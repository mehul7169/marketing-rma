import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

/** Job name is free-form text (hourly crons + per-account backfill-{uuid}). */
export type CronRunJob = string;

export type CronRunLog = {
  job: CronRunJob;
  status: "success" | "error";
  rows_upserted: number | null;
  error: string | null;
};

export function backfillCronJobName(adAccountId: string): string {
  return `backfill-${adAccountId}`;
}

export async function logCronRun(run: CronRunLog) {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  const { error } = await supabaseAdmin.from("cron_runs").insert({
    job: run.job,
    status: run.status,
    rows_upserted: run.rows_upserted,
    error: run.error
  });

  if (error) throw error;
}

export async function getLatestCronRunForJob(job: string): Promise<{
  status: "success" | "error";
  rows_upserted: number | null;
  error: string | null;
  ran_at: string;
} | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("cron_runs")
    .select("status, rows_upserted, error, ran_at")
    .eq("job", job)
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    status: data.status === "error" ? "error" : "success",
    rows_upserted:
      data.rows_upserted === null || data.rows_upserted === undefined
        ? null
        : Number(data.rows_upserted),
    error: (data.error as string | null) ?? null,
    ran_at: String(data.ran_at)
  };
}
