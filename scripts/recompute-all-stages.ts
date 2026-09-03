#!/usr/bin/env node
/**
 * One-off: recompute stage + lifecycle_status for every lead via the shared
 * TypeScript helpers (not SQL), and log every row that actually changed.
 *
 * Usage:
 *   npx tsx --env-file=.env.local --env-file=.env scripts/recompute-all-stages.ts
 *   npx tsx --env-file=.env.local --env-file=.env scripts/recompute-all-stages.ts --confirm
 */

import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { config as loadEnv } from "dotenv";
import { listAllLeads, updateLead } from "../src/lib/db/leads";
import { computeLifecycleStatus } from "../src/lib/leads/computeLifecycleStatus";
import { computeStage } from "../src/lib/leads/computeStage";
import type { LeadRow } from "../src/lib/leads/types";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

function derived(lead: LeadRow) {
  return {
    deal_closed: lead.deal_closed,
    post_call_status: lead.post_call_status,
    setter_verified: lead.setter_verified,
    call_booked_at: lead.call_booked_at,
    requalification_result: lead.requalification_result,
    requalification_attempted: lead.requalification_attempted,
    call_showed: lead.call_showed,
    qualified: lead.qualified,
    form_filled_at: lead.form_filled_at
  };
}

async function requireConfirm(confirmFlag: boolean) {
  if (confirmFlag) return;
  if (!process.stdin.isTTY) {
    console.error("Refusing to run without --confirm in a non-interactive session.");
    process.exit(1);
  }
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    "Recompute stage + lifecycle_status for every lead and write changes to Supabase. Continue? [y/N] "
  );
  rl.close();
  if (answer.trim().toLowerCase() !== "y") {
    console.error("Aborted.");
    process.exit(1);
  }
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  await requireConfirm(confirm);

  const leads = await listAllLeads();
  console.log(`Loaded ${leads.length} leads.`);

  let changed = 0;
  let unchanged = 0;

  for (const lead of leads) {
    const input = derived(lead);
    const nextStage = computeStage(input);
    const nextLife = computeLifecycleStatus(input);
    const stageChanged = (lead.stage ?? null) !== nextStage;
    const lifeChanged = (lead.lifecycle_status ?? null) !== nextLife;

    if (!stageChanged && !lifeChanged) {
      unchanged += 1;
      continue;
    }

    console.log(
      [
        lead.id,
        lead.email,
        stageChanged
          ? `stage: ${lead.stage ?? "null"} → ${nextStage}`
          : `stage unchanged (${lead.stage ?? "null"})`,
        lifeChanged
          ? `lifecycle: ${lead.lifecycle_status ?? "null"} → ${nextLife}`
          : `lifecycle unchanged (${lead.lifecycle_status ?? "null"})`
      ].join(" | ")
    );

    // updateLead always runs stamp() again — empty patch still recomputes and persists.
    await updateLead(lead, {});
    changed += 1;
  }

  console.log(`\nDone. Changed: ${changed}. Unchanged: ${unchanged}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
