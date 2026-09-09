/**
 * Callable Meta ads backfill — used by the CLI script and (later) /clients-ads
 * "Add Ad Account" on-demand backfill for a single newly added account.
 */

import { formatChunkLabel, getMonthlyChunks } from "@/lib/ingest/chunks";
import {
  getMetaAccessTokenFromEnv,
  ingestMetaAdsForAccount,
  META_ACCOUNT_INGEST_DELAY_MS
} from "@/lib/ingest/meta";
import { withRetry } from "@/lib/ingest/retry";
import {
  getAdAccountById,
  listActiveAdAccounts,
  type AdAccountRow
} from "@/lib/db/ad_accounts";

export type MetaBackfillFailedChunk = {
  adAccountId: string;
  clientName: string;
  start: string;
  end: string;
  error: string;
};

export type MetaBackfillAccountSummary = {
  adAccountId: string;
  clientName: string;
  metaAdAccountId: string;
  rowsUpserted: number;
  failedChunks: MetaBackfillFailedChunk[];
  error: string | null;
};

export type MetaBackfillSummary = {
  fromISO: string;
  toISO: string;
  rowsUpserted: number;
  accounts: MetaBackfillAccountSummary[];
  failedChunks: MetaBackfillFailedChunk[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfillOneAccount(
  account: AdAccountRow,
  fromISO: string,
  toISO: string,
  accessToken: string,
  log: (msg: string) => void
): Promise<MetaBackfillAccountSummary> {
  const chunks = getMonthlyChunks(fromISO, toISO);
  const summary: MetaBackfillAccountSummary = {
    adAccountId: account.id,
    clientName: account.client_name,
    metaAdAccountId: account.meta_ad_account_id,
    rowsUpserted: 0,
    failedChunks: [],
    error: null
  };

  log(
    `Meta [${account.client_name}]: ${chunks.length} monthly chunk(s) ${fromISO} → ${toISO}`
  );

  for (const chunk of chunks) {
    const label = formatChunkLabel(chunk);
    try {
      const rows = await withRetry(
        () =>
          ingestMetaAdsForAccount(account, chunk.start, chunk.end, accessToken),
        { label: `Meta ${account.client_name} ${label}` }
      );
      summary.rowsUpserted += rows;
      log(`Meta [${account.client_name}]: pulled ${label} — ${rows} rows upserted`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failedChunks.push({
        adAccountId: account.id,
        clientName: account.client_name,
        start: chunk.start,
        end: chunk.end,
        error: message
      });
      log(`Meta [${account.client_name}]: FAILED ${label} — ${message}`);
    }
  }

  return summary;
}

export type BackfillMetaAdsOptions = {
  /** When set, backfill only this ad_accounts.id (for /clients-ads add flow). */
  adAccountId?: string;
  /** Delay between accounts — see META_ACCOUNT_INGEST_DELAY_MS. */
  delayMs?: number;
  log?: (msg: string) => void;
};

/**
 * Backfill Meta insights into meta_ads_daily.
 * - Default: every active ad_accounts row, sequentially with rate-limit delay.
 * - With `adAccountId`: only that account (active or not — needed right after add).
 */
export async function backfillMetaAds(
  fromISO: string,
  toISO: string,
  options: BackfillMetaAdsOptions = {}
): Promise<MetaBackfillSummary> {
  const log = options.log ?? ((msg: string) => console.log(msg));
  const accessToken = getMetaAccessTokenFromEnv();
  const delayMs = options.delayMs ?? META_ACCOUNT_INGEST_DELAY_MS;

  let accounts: AdAccountRow[];
  if (options.adAccountId) {
    const one = await getAdAccountById(options.adAccountId);
    if (!one) {
      throw new Error(`ad_accounts row not found: ${options.adAccountId}`);
    }
    accounts = [one];
  } else {
    accounts = await listActiveAdAccounts();
  }

  if (accounts.length === 0) {
    throw new Error(
      "No ad accounts to backfill — seed ad_accounts or pass adAccountId."
    );
  }

  const accountSummaries: MetaBackfillAccountSummary[] = [];
  let rowsUpserted = 0;
  const failedChunks: MetaBackfillFailedChunk[] = [];

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i]!;
    try {
      const summary = await backfillOneAccount(
        account,
        fromISO,
        toISO,
        accessToken,
        log
      );
      accountSummaries.push(summary);
      rowsUpserted += summary.rowsUpserted;
      failedChunks.push(...summary.failedChunks);
    } catch (error) {
      // Whole-account failure (should be rare — chunk errors are caught above).
      const message = error instanceof Error ? error.message : String(error);
      log(`Meta [${account.client_name}]: account aborted — ${message}`);
      accountSummaries.push({
        adAccountId: account.id,
        clientName: account.client_name,
        metaAdAccountId: account.meta_ad_account_id,
        rowsUpserted: 0,
        failedChunks: [],
        error: message
      });
    }

    if (i < accounts.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    fromISO,
    toISO,
    rowsUpserted,
    accounts: accountSummaries,
    failedChunks
  };
}
