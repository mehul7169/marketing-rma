#!/usr/bin/env node
/**
 * One-off historical backfill for Meta Ads, GA4, and Wistia.
 *
 * Usage:
 *   npx tsx scripts/backfill.ts --source=all --from=2024-01-01 --confirm
 *   npx tsx scripts/backfill.ts --source=meta --from=2024-06-01
 *
 * Loads env from .env.local then .env (same as local dev).
 * Requires --confirm or an interactive y/N prompt before writing to Supabase.
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { subYears } from "date-fns";
import { formatChunkLabel, getMonthlyChunks, type DateChunk } from "../src/lib/ingest/chunks";
import { ingestGa4Range, getGa4IngestConfigFromEnv } from "../src/lib/ingest/ga4";
import {
  getMetaIngestConfigFromEnv,
  ingestMetaAdsRange
} from "../src/lib/ingest/meta";
import { withRetry } from "../src/lib/ingest/retry";
import {
  getWistiaIngestConfigFromEnv,
  ingestWistiaHistoricalRange
} from "../src/lib/ingest/wistia";
import { toISODate } from "../src/lib/utils/date";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

type Source = "meta" | "ga4" | "wistia" | "all";

type CliOptions = {
  source: Source;
  fromISO: string;
  toISO: string;
  confirm: boolean;
};

type SourceSummary = {
  source: Source;
  rowsUpserted: number;
  fromISO: string;
  toISO: string;
  failedChunks: FailedChunk[];
  notes: string[];
};

type FailedChunk = {
  source: Source;
  chunk: DateChunk;
  error: string;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let source: Source = "all";
  let fromISO: string | undefined;
  let toISO: string | undefined;
  let confirm = false;

  for (const arg of args) {
    if (arg === "--confirm") {
      confirm = true;
    } else if (arg.startsWith("--source=")) {
      const value = arg.split("=")[1] as Source;
      if (!["meta", "ga4", "wistia", "all"].includes(value)) {
        throw new Error(`Invalid --source value: ${value}`);
      }
      source = value;
    } else if (arg.startsWith("--from=")) {
      fromISO = arg.split("=")[1];
    } else if (arg.startsWith("--to=")) {
      toISO = arg.split("=")[1];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const today = new Date();
  toISO = toISO ?? toISODate(today);
  fromISO = fromISO ?? toISODate(subYears(today, 1));

  return { source, fromISO, toISO, confirm };
}

function printHelp() {
  console.log(`
Historical backfill — loads data into meta_ads_daily and website_daily.

Usage:
  npx tsx scripts/backfill.ts [options]

Options:
  --source=meta|ga4|wistia|all   Source to backfill (default: all)
  --from=YYYY-MM-DD              Start date inclusive (default: 1 year ago)
  --to=YYYY-MM-DD                End date inclusive (default: today)
  --confirm                      Skip interactive confirmation prompt
  -h, --help                     Show this help

Examples:
  npx tsx scripts/backfill.ts --source=meta --from=2024-01-01 --confirm
  npx tsx scripts/backfill.ts --source=all --from=2023-06-01
`);
}

async function requireConfirmation(options: CliOptions, sources: Source[]) {
  if (options.confirm) return;

  if (!process.stdin.isTTY) {
    console.error(
      "Refusing to run without --confirm in a non-interactive session."
    );
    console.error("Re-run with --confirm to proceed.");
    process.exit(1);
  }

  const rl = createInterface({ input, output });
  const answer = await rl.question(
    `Backfill ${sources.join(", ")} from ${options.fromISO} to ${options.toISO} into Supabase. Continue? [y/N] `
  );
  rl.close();

  if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }
}

function sourcesToRun(source: Source): Array<Exclude<Source, "all">> {
  if (source === "all") return ["meta", "ga4", "wistia"];
  return [source];
}

async function backfillMeta(
  fromISO: string,
  toISO: string
): Promise<SourceSummary> {
  const config = getMetaIngestConfigFromEnv();
  const chunks = getMonthlyChunks(fromISO, toISO);
  const summary: SourceSummary = {
    source: "meta",
    rowsUpserted: 0,
    fromISO,
    toISO,
    failedChunks: [],
    notes: []
  };

  console.log(`\nMeta Ads: ${chunks.length} monthly chunk(s) from ${fromISO} to ${toISO}`);

  for (const chunk of chunks) {
    const label = formatChunkLabel(chunk);
    try {
      const rows = await withRetry(
        () => ingestMetaAdsRange(config, chunk.start, chunk.end),
        { label: `Meta ${label}` }
      );
      summary.rowsUpserted += rows;
      console.log(`Meta: pulled ${label} — ${rows} rows upserted`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failedChunks.push({ source: "meta", chunk, error: message });
      console.error(`Meta: FAILED ${label} — ${message}`);
    }
  }

  return summary;
}

async function backfillGa4(fromISO: string, toISO: string): Promise<SourceSummary> {
  const config = getGa4IngestConfigFromEnv();
  const chunks = getMonthlyChunks(fromISO, toISO);
  const summary: SourceSummary = {
    source: "ga4",
    rowsUpserted: 0,
    fromISO,
    toISO,
    failedChunks: [],
    notes: []
  };

  console.log(`\nGA4: ${chunks.length} monthly chunk(s) from ${fromISO} to ${toISO}`);

  for (const chunk of chunks) {
    const label = formatChunkLabel(chunk);
    try {
      const rows = await withRetry(
        () => ingestGa4Range(config, chunk.start, chunk.end),
        { label: `GA4 ${label}` }
      );
      summary.rowsUpserted += rows;
      console.log(`GA4: pulled ${label} — ${rows} rows upserted`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failedChunks.push({ source: "ga4", chunk, error: message });
      console.error(`GA4: FAILED ${label} — ${message}`);
    }
  }

  return summary;
}

async function backfillWistia(
  fromISO: string,
  toISO: string
): Promise<SourceSummary> {
  const config = getWistiaIngestConfigFromEnv();
  const chunks = getMonthlyChunks(fromISO, toISO);
  const summary: SourceSummary = {
    source: "wistia",
    rowsUpserted: 0,
    fromISO,
    toISO,
    failedChunks: [],
    notes: []
  };

  console.log(`\nWistia: ${chunks.length} monthly chunk(s) from ${fromISO} to ${toISO}`);

  for (const chunk of chunks) {
    const label = formatChunkLabel(chunk);
    try {
      const result = await withRetry(
        () => ingestWistiaHistoricalRange(config, chunk.start, chunk.end),
        { label: `Wistia ${label}` }
      );

      summary.rowsUpserted += result.rowsUpserted;

      if (result.note && !summary.notes.includes(result.note)) {
        summary.notes.push(result.note);
      }

      if (!result.dailyPlayCountsAvailable && result.note) {
        console.warn(`Wistia: ${result.note}`);
      } else {
        console.log(`Wistia: pulled ${label} — ${result.rowsUpserted} rows upserted`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failedChunks.push({ source: "wistia", chunk, error: message });
      console.error(`Wistia: FAILED ${label} — ${message}`);
    }
  }

  if (summary.rowsUpserted === 0 && summary.notes.length === 0) {
    summary.notes.push(
      "Wistia does not provide historical daily breakdown via this endpoint — only current aggregate stats are available going forward from today."
    );
  }

  return summary;
}

function printSummary(summaries: SourceSummary[]) {
  console.log("\n========== Backfill summary ==========");

  let metaRows = 0;
  let websiteRows = 0;
  const allFailed: FailedChunk[] = [];

  for (const s of summaries) {
    if (s.source === "meta") metaRows += s.rowsUpserted;
    else websiteRows += s.rowsUpserted;

    console.log(`\n${s.source.toUpperCase()}`);
    console.log(`  Date range: ${s.fromISO} → ${s.toISO}`);
    console.log(`  Rows upserted: ${s.rowsUpserted}`);
    for (const note of s.notes) {
      console.log(`  Note: ${note}`);
    }
    allFailed.push(...s.failedChunks);
  }

  console.log("\nTotals");
  console.log(`  meta_ads_daily:   ${metaRows} rows`);
  console.log(`  website_daily:    ${websiteRows} rows (GA4 + Wistia combined)`);

  if (allFailed.length > 0) {
    console.log("\nFailed chunks (re-run individually with --source and narrow --from/--to):");
    for (const f of allFailed) {
      console.log(
        `  [${f.source}] ${f.chunk.start} → ${f.chunk.end}: ${f.error}`
      );
    }
  } else {
    console.log("\nNo failed chunks.");
  }

  console.log("======================================\n");
}

async function main() {
  let options: CliOptions;
  try {
    options = parseArgs();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    printHelp();
    process.exit(1);
  }

  const runList = sourcesToRun(options.source);
  await requireConfirmation(options, runList);

  console.log(
    `Starting backfill: sources=${runList.join(", ")}, range=${options.fromISO} → ${options.toISO}`
  );

  const summaries: SourceSummary[] = [];

  for (const src of runList) {
    if (src === "meta") {
      summaries.push(await backfillMeta(options.fromISO, options.toISO));
    } else if (src === "ga4") {
      summaries.push(await backfillGa4(options.fromISO, options.toISO));
    } else if (src === "wistia") {
      summaries.push(await backfillWistia(options.fromISO, options.toISO));
    }
  }

  printSummary(summaries);

  const hasFailures = summaries.some((s) => s.failedChunks.length > 0);
  process.exit(hasFailures ? 1 : 0);
}

main().catch((error) => {
  console.error("Backfill aborted:", error instanceof Error ? error.message : error);
  process.exit(1);
});
