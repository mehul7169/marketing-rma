import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

export type CronRunJob = "meta-ads" | "ga4" | "wistia";

export type CronRunLog = {
  job: CronRunJob;
  status: "success" | "error";
  rows_upserted: number | null;
  error: string | null;
};

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

