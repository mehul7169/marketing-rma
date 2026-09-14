#!/usr/bin/env node
/**
 * One-time: set call_confirmed=true for leads that reached the old
 * “Verified” / show / closed milestones without the new flag.
 * Overview “Qualified Call Booked” counts call_confirmed; without this
 * backfill, showed/closed leads are missing from that step.
 *
 * Usage:
 *   npx tsx --env-file=.env.local --env-file=.env scripts/backfill-call-confirmed.ts --confirm
 */

import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { config as loadEnv } from "dotenv";
import { listAllLeads, updateLead } from "../src/lib/db/leads";
import { listOrganizations } from "../src/lib/db/organizations";
import type { LeadRow } from "../src/lib/leads/types";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

function shouldConfirm(lead: LeadRow): boolean {
  if (lead.call_confirmed === true) return false;
  // Old Verified ≡ new Qualified Call Booked
  if (lead.setter_verified === true) return true;
  // Later milestones imply they passed through qualification
  if (lead.call_showed === true) return true;
  if (lead.deal_closed === true) return true;
  return false;
}

async function requireConfirm(confirmFlag: boolean) {
  if (confirmFlag) return;
  if (!process.stdin.isTTY) {
    console.error("Refusing to run without --confirm in a non-interactive session.");
    process.exit(1);
  }
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    "Backfill call_confirmed=true for legacy verified/showed/closed leads? [y/N] "
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
  let changed = 0;
  let skipped = 0;

  for (const org of orgs) {
    const leads = await listAllLeads(org.id);
    console.log(`\n[${org.slug}] ${leads.length} leads`);
    for (const lead of leads) {
      if (!shouldConfirm(lead)) {
        skipped += 1;
        continue;
      }
      console.log(
        `${lead.id} | ${lead.email} | setter_verified=${lead.setter_verified} showed=${lead.call_showed} closed=${lead.deal_closed}`
      );
      await updateLead(lead, {
        call_confirmed: true,
        // Preserve Work Queue field; stage/lifecycle still restamp.
        action_status: lead.action_status
      });
      changed += 1;
    }
  }

  console.log(`\nDone. Updated: ${changed}. Skipped: ${skipped}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
