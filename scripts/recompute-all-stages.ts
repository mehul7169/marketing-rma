#!/usr/bin/env node
/**
 * One-time: recompute lead.stage (+ lifecycle_status) for every lead via the
 * shared TypeScript helpers. Also migrates legacy "dead" encodings onto
 * is_dead so stage/lifecycle stay consistent with the redesigned model.
 *
 * Does not invent action_status changes for non-dead leads — existing
 * action_status is preserved unless the lead is marked dead (then Dead).
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
import { listOrganizations } from "../src/lib/db/organizations";
import { computeLifecycleStatus } from "../src/lib/leads/computeLifecycleStatus";
import { computeStage } from "../src/lib/leads/computeStage";
import type { LeadRow } from "../src/lib/leads/types";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

/** Legacy paths that meant "dead" before is_dead was the single flag. */
function needsLegacyDeadMigration(lead: LeadRow): boolean {
  if (lead.is_dead) return false;
  if (lead.post_call_status === "dead") return true;
  if (lead.setter_verified === false && lead.call_booked_at) return true;
  return false;
}

function legacyDeadReason(lead: LeadRow): string | null {
  if (lead.dead_reason) return lead.dead_reason;
  if (lead.post_call_status === "dead") return "post call";
  if (lead.setter_verified === false && lead.call_booked_at) {
    return "booked but not confirmed qualified";
  }
  return null;
}

function nextStage(lead: LeadRow) {
  return computeStage({
    deal_closed: lead.deal_closed,
    is_dead: Boolean(lead.is_dead),
    post_call_status: lead.post_call_status,
    call_showed: lead.call_showed,
    call_confirmed: lead.call_confirmed,
    call_booked_at: lead.call_booked_at
  });
}

function nextLifecycle(lead: LeadRow) {
  return computeLifecycleStatus({
    deal_closed: lead.deal_closed,
    is_dead: Boolean(lead.is_dead),
    call_booked_at: lead.call_booked_at,
    qualified: lead.qualified
  });
}

async function requireConfirm(confirmFlag: boolean) {
  if (confirmFlag) return;
  if (!process.stdin.isTTY) {
    console.error("Refusing to run without --confirm in a non-interactive session.");
    process.exit(1);
  }
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    "Recompute stage (+ lifecycle_status) for every lead across all orgs. Continue? [y/N] "
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

  const orgs = await listOrganizations();
  console.log(`Orgs: ${orgs.length}`);

  let changed = 0;
  let unchanged = 0;
  let migratedDead = 0;

  for (const org of orgs) {
    const leads = await listAllLeads(org.id);
    console.log(`\n[${org.slug}] ${leads.length} leads`);

    for (const lead of leads) {
      const patch: Partial<LeadRow> = {};

      if (needsLegacyDeadMigration(lead)) {
        patch.is_dead = true;
        patch.dead_reason = legacyDeadReason(lead);
        if (lead.post_call_status === "dead") {
          patch.post_call_status = null;
        }
        migratedDead += 1;
      }

      const preview: LeadRow = { ...lead, ...patch };
      const stage = nextStage(preview);
      const life = nextLifecycle(preview);
      const stageChanged = (lead.stage ?? null) !== stage;
      const lifeChanged = (lead.lifecycle_status ?? null) !== life;
      const deadMigrated = patch.is_dead === true;

      if (!stageChanged && !lifeChanged && !deadMigrated) {
        unchanged += 1;
        continue;
      }

      console.log(
        [
          lead.id,
          lead.email,
          deadMigrated ? "migrated is_dead=true" : null,
          stageChanged
            ? `stage: ${lead.stage ?? "null"} → ${stage}`
            : `stage unchanged (${lead.stage ?? "null"})`,
          lifeChanged
            ? `lifecycle: ${lead.lifecycle_status ?? "null"} → ${life}`
            : `lifecycle unchanged (${lead.lifecycle_status ?? "null"})`
        ]
          .filter(Boolean)
          .join(" | ")
      );

      // Preserve Work Queue action_status unless this lead is newly marked dead.
      if (deadMigrated) {
        patch.action_status = "Dead";
      } else {
        patch.action_status = lead.action_status;
      }

      await updateLead(lead, patch);
      changed += 1;
    }
  }

  console.log(
    `\nDone. Changed: ${changed}. Unchanged: ${unchanged}. Legacy dead → is_dead: ${migratedDead}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
