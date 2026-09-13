import { subMonths } from "date-fns";
import {
  getAdAccountByMetaId,
  insertAdAccount,
  metaAdAccountIdVariants,
  normalizeMetaAdAccountId,
  type AdAccountRow
} from "@/lib/db/ad_accounts";
import {
  backfillCronJobName,
  logCronRun
} from "@/lib/db/cron_runs";
import { remappingMetaAdsDailyAccountId } from "@/lib/db/meta_ads_daily";
import { backfillMetaAds, type MetaBackfillSummary } from "@/lib/ingest/backfillMeta";
import { getMetaAccessTokenFromEnv } from "@/lib/ingest/meta";
import { todayISTDateString } from "@/lib/timezone";
import { toISODate } from "@/lib/utils/date";

export type AddClientAccountResult =
  | {
      status: "created";
      account: AdAccountRow;
      clientName: string;
      /** Present when waitForBackfill is true (seed scripts). */
      backfill: MetaBackfillSummary | null;
      backfillPending: boolean;
    }
  | {
      status: "skipped";
      account: AdAccountRow;
      clientName: string;
      reason: "already_exists";
    };

export type AddClientAccountOptions = {
  orgId: string;
  log?: (msg: string) => void;
  /**
   * When true (default), await the 2-month backfill before returning.
   * When false, kick off backfill in the background and return immediately
   * after the account row is inserted (for /clients-ads API).
   */
  waitForBackfill?: boolean;
  /** Optional scheduler (e.g. Vercel waitUntil) so background work outlives the response. */
  scheduleBackground?: (task: Promise<unknown>) => void;
};

export { toActPrefixedAdAccountId } from "@/lib/clients/metaAdAccountId";

/**
 * Shared "Add Ad Account" path for /clients-ads and seed scripts:
 * skip if known → resolve name from Meta → insert → backfill last 2 months.
 * Does not set is_lead_source (clients only).
 * Name resolve runs before insert, so invalid/no-access IDs never create a row.
 */
export async function addClientAccount(
  metaAdAccountIdRaw: string,
  options: AddClientAccountOptions
): Promise<AddClientAccountResult> {
  const log = options.log ?? (() => {});
  const waitForBackfill = options.waitForBackfill ?? true;
  const scheduleBackground = options.scheduleBackground ?? ((task) => void task);
  const orgId = options.orgId;
  if (!orgId) throw new Error("addClientAccount requires orgId");

  const metaAdAccountId = normalizeMetaAdAccountId(metaAdAccountIdRaw);

  const existing = await getAdAccountByMetaId(metaAdAccountId, orgId);
  if (existing) {
    return {
      status: "skipped",
      account: existing,
      clientName: existing.client_name,
      reason: "already_exists"
    };
  }

  const clientName = await resolveMetaAdAccountName(metaAdAccountId);
  log(`Resolved ${metaAdAccountId} → "${clientName}"`);

  const account = await insertAdAccount({
    org_id: orgId,
    meta_ad_account_id: metaAdAccountId,
    client_name: clientName,
    is_lead_source: false,
    active: true
  });

  // Reclaim historical rows parked under act_… / bare id after a prior delete.
  for (const variant of metaAdAccountIdVariants(metaAdAccountId)) {
    const moved = await remappingMetaAdsDailyAccountId(variant, account.id, orgId);
    if (moved > 0) {
      log(`Reclaimed ${moved} historical meta_ads_daily row(s) from ${variant}`);
    }
  }

  const toISO = todayISTDateString();
  const fromISO = toISODate(subMonths(new Date(), 2));
  log(`Backfill starting for ${clientName} (${fromISO} → ${toISO})`);

  if (waitForBackfill) {
    const backfill = await runBackfillLogged(account, fromISO, toISO, log);
    return {
      status: "created",
      account,
      clientName,
      backfill,
      backfillPending: false
    };
  }

  scheduleBackground(
    runBackfillLogged(account, fromISO, toISO, log).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[addClientAccount] background backfill failed: ${msg}`);
    })
  );

  return {
    status: "created",
    account,
    clientName,
    backfill: null,
    backfillPending: true
  };
}

async function runBackfillLogged(
  account: AdAccountRow,
  fromISO: string,
  toISO: string,
  log: (msg: string) => void
): Promise<MetaBackfillSummary> {
  const job = backfillCronJobName(account.id);
  try {
    const backfill = await backfillMetaAds(fromISO, toISO, {
      adAccountId: account.id,
      delayMs: 0,
      log
    });
    const failed = backfill.failedChunks.length > 0;
    await logCronRun({
      job,
      status: failed && backfill.rowsUpserted === 0 ? "error" : "success",
      rows_upserted: backfill.rowsUpserted,
      error: failed
        ? backfill.failedChunks.map((c) => c.error).join(" | ")
        : null
    });
    return backfill;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCronRun({
      job,
      status: "error",
      rows_upserted: null,
      error: msg
    });
    throw e;
  }
}

async function resolveMetaAdAccountName(metaAdAccountId: string): Promise<string> {
  const accessToken = getMetaAccessTokenFromEnv();
  const actId = normalizeMetaAdAccountId(metaAdAccountId);
  const url = new URL(`https://graph.facebook.com/v19.0/${actId}`);
  url.searchParams.set("fields", "name,business_name");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json()) as {
    name?: string;
    business_name?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      json.error?.message ??
        `Meta account lookup failed for ${actId}: HTTP ${res.status}`
    );
  }

  const name = (json.name ?? json.business_name ?? "").trim();
  if (!name) {
    throw new Error(`Meta returned no name for ${actId}`);
  }
  return name;
}
