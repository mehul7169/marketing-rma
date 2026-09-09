#!/usr/bin/env node
/**
 * One-off seed: add client Meta ad accounts via the shared addClientAccount path
 * (same function /clients-ads will use). Sequential with rate-limit delay.
 *
 *   npx tsx --env-file=.env.local --env-file=.env scripts/seed-client-accounts.ts
 *
 * Also loads .env.local then .env via dotenv before importing app modules
 * (supabaseAdmin reads env at import time).
 */

import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const ACCOUNT_IDS = [
  "act_539253822308075",
  "act_933687532533584",
  "act_522950523455873",
  "act_6474627355960003",
  "act_3421848171329750",
  "act_4428716704065662",
  "act_786554433362354",
  "act_1343495287409462",
  "act_1756260332324979",
  "act_1021566945340998",
  "act_175644709",
  "act_1646724656105592"
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Outcome =
  | { id: string; kind: "created"; clientName: string; rows: number }
  | { id: string; kind: "skipped"; clientName: string }
  | { id: string; kind: "failed"; error: string };

async function main() {
  const { addClientAccount } = await import("../src/lib/clients/addClientAccount");
  const { META_ACCOUNT_INGEST_DELAY_MS } = await import("../src/lib/ingest/meta");
  const { listActiveAdAccounts } = await import("../src/lib/db/ad_accounts");

  console.log(`Seeding ${ACCOUNT_IDS.length} client ad accounts via addClientAccount…\n`);

  const outcomes: Outcome[] = [];

  for (let i = 0; i < ACCOUNT_IDS.length; i++) {
    const id = ACCOUNT_IDS[i]!;
    console.log(`── [${i + 1}/${ACCOUNT_IDS.length}] ${id}`);

    try {
      const result = await addClientAccount(id, {
        log: (msg) => console.log(`   ${msg}`)
      });

      if (result.status === "skipped") {
        console.log(
          `   SKIPPED — already exists as "${result.clientName}" (${result.account.id})`
        );
        outcomes.push({
          id,
          kind: "skipped",
          clientName: result.clientName
        });
      } else {
        const rows = result.backfill?.rowsUpserted ?? 0;
        console.log(
          `   CREATED — "${result.clientName}" (${result.account.id}); backfill → ${rows} rows`
        );
        outcomes.push({
          id,
          kind: "created",
          clientName: result.clientName,
          rows
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`   FAILED — ${message}`);
      outcomes.push({ id, kind: "failed", error: message });
    }

    // Same rate-limit buffer as multi-account ingestion between Meta act_* calls.
    if (i < ACCOUNT_IDS.length - 1) {
      await sleep(META_ACCOUNT_INGEST_DELAY_MS);
    }
  }

  const created = outcomes.filter((o) => o.kind === "created");
  const skipped = outcomes.filter((o) => o.kind === "skipped");
  const failed = outcomes.filter((o) => o.kind === "failed");

  console.log("\n========== Seed summary ==========");
  console.log(`Succeeded (created + backfill): ${created.length}`);
  console.log(`Skipped (already existed):      ${skipped.length}`);
  console.log(`Failed:                         ${failed.length}`);

  if (created.length) {
    console.log("\nCreated:");
    for (const o of created) {
      if (o.kind === "created") {
        console.log(`  ✓ ${o.id} → ${o.clientName} (${o.rows} rows)`);
      }
    }
  }
  if (skipped.length) {
    console.log("\nSkipped:");
    for (const o of skipped) {
      if (o.kind === "skipped") {
        console.log(`  · ${o.id} → ${o.clientName}`);
      }
    }
  }
  if (failed.length) {
    console.log("\nFailed:");
    for (const o of failed) {
      if (o.kind === "failed") {
        console.log(`  ✗ ${o.id}: ${o.error}`);
      }
    }
  }

  const active = await listActiveAdAccounts();
  console.log(`\nActive ad_accounts now: ${active.length}`);
  for (const a of active) {
    console.log(
      `  ${a.is_lead_source ? "[lead]" : "[client]"} ${a.client_name} (${a.meta_ad_account_id})`
    );
  }
  console.log("==================================\n");

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Seed aborted:", e instanceof Error ? e.message : e);
  process.exit(1);
});
