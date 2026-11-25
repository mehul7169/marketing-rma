#!/usr/bin/env node
/**
 * Write Meta ad spend into the Master AdSpend sheet.
 *
 *   npx tsx scripts/adspend-sheet-sync.ts --from=2026-11-25 --to=2026-11-25 [--client=Vaidehi] [--dry-run]
 *
 * Loads .env.local then .env before importing app modules.
 * Does not write ad_accounts or meta_ads_daily.
 */

import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

type Cli = {
  fromISO: string | null;
  toISO: string | null;
  dryRun: boolean;
  clients: string[];
};

function parseArgs(argv: string[]): Cli {
  let fromISO: string | null = null;
  let toISO: string | null = null;
  let dryRun = false;
  const clients: string[] = [];
  for (const arg of argv) {
    if (arg === "--dry-run" || arg === "--dry_run") dryRun = true;
    else if (arg.startsWith("--from=")) fromISO = arg.slice("--from=".length).trim() || null;
    else if (arg.startsWith("--to=")) toISO = arg.slice("--to=".length).trim() || null;
    else if (arg.startsWith("--client=")) {
      const v = arg.slice("--client=".length).trim();
      if (v) clients.push(v);
    }
  }
  return { fromISO, toISO, dryRun, clients };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const { ADSPEND_JOB, adspendRunNotes, printDryRun, syncAdspendSheet } = await import(
    "../src/lib/adspend/sync"
  );
  const { logCronRun } = await import("../src/lib/db/cron_runs");

  const result = await syncAdspendSheet({
    fromISO: cli.fromISO ?? undefined,
    toISO: cli.toISO ?? undefined,
    dryRun: cli.dryRun,
    clients: cli.clients
  });

  console.log(printDryRun(result));
  if (result.warnings.length) {
    console.log("\nwarnings:");
    for (const w of result.warnings) console.log(`- ${w}`);
  }

  if (!cli.dryRun && !cli.clients.length) {
    const notes = adspendRunNotes({
      ...result,
      skippedNoId: result.skippedNoId
    });
    const accountErrors = result.accounts
      .filter((a) => a.status === "error")
      .map((a) => `${a.client}: ${a.error}`)
      .join(" | ");
    await logCronRun({
      job: ADSPEND_JOB,
      status: result.ok ? "success" : "error",
      rows_upserted: result.rowsUpserted,
      error: result.ok ? accountErrors || null : result.error ?? notes
    });
  }

  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
