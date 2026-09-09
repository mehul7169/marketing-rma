/**
 * One-off: remap legacy RMA meta_ads_daily.ad_account_id values
 * (bare Meta id / duplicate lead-source UUID) onto the canonical
 * is_lead_source row with act_… meta_ad_account_id.
 *
 *   npx tsx --env-file=.env.local --env-file=.env scripts/remap-rma-ad-account-ids.ts
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { supabaseAdmin } = await import("../src/lib/db/supabaseAdmin");
  const { getLeadSourceAdAccount, listActiveAdAccounts } = await import(
    "../src/lib/db/ad_accounts"
  );
  const { getMetaAdsTotals } = await import("../src/lib/db/meta_ads_daily");

  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const db = supabaseAdmin;

  const canonical = await getLeadSourceAdAccount();
  if (!canonical) throw new Error("No lead-source ad account");
  if (!canonical.meta_ad_account_id.startsWith("act_")) {
    throw new Error(
      `Expected canonical lead-source to use act_ prefix, got ${canonical.meta_ad_account_id}`
    );
  }

  const all = await listActiveAdAccounts();
  const leadSources = all.filter((a) => a.is_lead_source);
  const duplicates = leadSources.filter((a) => a.id !== canonical.id);
  const bareMeta = canonical.meta_ad_account_id.slice("act_".length);
  const legacyIds = Array.from(
    new Set([bareMeta, ...duplicates.map((d) => d.id), ...duplicates.map((d) => d.meta_ad_account_id)])
  ).filter((id) => id && id !== canonical.id);

  console.log("Canonical RMA:", canonical.id, canonical.meta_ad_account_id);
  console.log("Legacy ids to remap:", legacyIds);

  // Drop duplicate UUID rows first (overlap with legacy bare-id rows).
  for (const dup of duplicates) {
    const { count, error } = await db
      .from("meta_ads_daily")
      .delete({ count: "exact" })
      .eq("ad_account_id", dup.id);
    if (error) throw error;
    console.log(`Deleted ${count ?? 0} rows stamped with duplicate UUID ${dup.id}`);
  }

  for (const legacy of legacyIds) {
    if (legacy === canonical.id) continue;
    // Skip if this legacy string is another account's UUID we already deleted
    const { count: before } = await db
      .from("meta_ads_daily")
      .select("id", { count: "exact", head: true })
      .eq("ad_account_id", legacy);

    if (!before) {
      console.log(`No rows for legacy id ${legacy}`);
      continue;
    }

    const { error, count } = await db
      .from("meta_ads_daily")
      .update({ ad_account_id: canonical.id }, { count: "exact" })
      .eq("ad_account_id", legacy);
    if (error) throw error;
    console.log(`Remapped ${count ?? before} rows ${legacy} → ${canonical.id}`);
  }

  for (const dup of duplicates) {
    const { error } = await db
      .from("ad_accounts")
      .update({ active: false, is_lead_source: false })
      .eq("id", dup.id);
    if (error) throw error;
    console.log(`Deactivated duplicate lead-source row ${dup.id} (${dup.meta_ad_account_id})`);
  }

  const fromISO = "2025-01-01";
  const toISO = "2026-09-09";
  const totals = await getMetaAdsTotals(fromISO, toISO, canonical.id);
  console.log(`Post-remap RMA totals ${fromISO}→${toISO}:`, totals);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
