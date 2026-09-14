/**
 * Measure sequential vs parallel cost of post-login server work (home page path).
 * Run: npx tsx --env-file=.env.local --env-file=.env scripts/profile-post-login.ts
 *
 * Uses service-role reads only — does not require a browser session cookie.
 * Auth timings are approximated with one membership + profile lookup (same DB
 * round-trips the SSR path performs per uncached request).
 */

import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { listDistinctLeadSources, listLeadsInRange } from "../src/lib/db/leads";
import { listOrganizations } from "../src/lib/db/organizations";
import { supabaseAdmin } from "../src/lib/db/supabaseAdmin";
import { defaultFromISO } from "../src/lib/utils/date";
import { todayISTDateString } from "../src/lib/timezone";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  console.log(`${label}: ${ms}ms`);
  return result;
}

async function main() {
  if (!supabaseAdmin) throw new Error("supabaseAdmin not configured");

  const orgs = await listOrganizations();
  const rma = orgs.find((o) => o.slug === "rma");
  if (!rma) throw new Error("rma org not found");

  const { data: member } = await supabaseAdmin
    .from("memberships")
    .select("user_id")
    .eq("org_id", rma.id)
    .limit(1)
    .maybeSingle();
  if (!member?.user_id) throw new Error("no member for rma");

  const userId = member.user_id;
  const today = todayISTDateString();
  const from = defaultFromISO(today);

  console.log("\n--- Sequential (uncached duplicate auth pattern) ---");
  let totalSeq = 0;
  for (const label of [
    "getUser (simulated)",
    "membership lookup",
    "platform admin lookup",
    "getUser again (layout)",
    "membership again (page)"
  ]) {
    const start = performance.now();
    if (label.includes("getUser")) {
      await supabaseAdmin.auth.admin.getUserById(userId);
    } else if (label.includes("membership")) {
      await supabaseAdmin
        .from("memberships")
        .select("org_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
    } else {
      await supabaseAdmin
        .from("profiles")
        .select("is_platform_admin")
        .eq("id", userId)
        .maybeSingle();
    }
    const ms = Math.round(performance.now() - start);
    totalSeq += ms;
    console.log(`${label}: ${ms}ms`);
  }
  const seqDataStart = performance.now();
  await listLeadsInRange(from, today, rma.id);
  await listDistinctLeadSources(rma.id);
  const seqDataMs = Math.round(performance.now() - seqDataStart);
  console.log(`home data (leads + sources sequential): ${seqDataMs}ms`);
  console.log(`TOTAL sequential auth+data: ${totalSeq + seqDataMs}ms`);

  console.log("\n--- Parallel (deduped auth + parallel data) ---");
  const parStart = performance.now();
  const [, , cohort, sources] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin
      .from("memberships")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
    listLeadsInRange(from, today, rma.id),
    listDistinctLeadSources(rma.id)
  ]);
  const parMs = Math.round(performance.now() - parStart);
  console.log(`auth+data parallel wall time: ${parMs}ms`);
  console.log(`cohort rows: ${cohort.length}, sources: ${sources.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
