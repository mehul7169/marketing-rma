import { eachIsoDay, isoToSheetDate } from "@/lib/adspend/dates";
import {
  DAILY_TAB,
  DATA_TAB,
  FEED_TAB,
  TRACKER_TAB,
  resolveWriteTarget,
  type WriteTarget
} from "@/lib/adspend/detectWriteTab";
import {
  MANAN_SUSPECT_BUSINESS_ID,
  META_POOL,
  fetchAccountDailySpend,
  listBusinessAdAccounts,
  mapPool,
  parseSpend,
  validateAdAccount,
  type DaySpend,
  type MetaAccountInfo
} from "@/lib/adspend/metaGraph";
import { actId, parseTrackerRows, type SkippedTrackerRow, type TrackerRow } from "@/lib/adspend/parseTracker";
import {
  applySheetOps,
  ensureTab,
  listSheetTabs,
  readRange
} from "@/lib/adspend/sheets";
import { planUpsert, parseExistingRows, type DesiredSpendRow } from "@/lib/adspend/upsertPlan";
import { addDaysISO } from "@/lib/utils/date";
import { todayISTDateString } from "@/lib/timezone";

export const ADSPEND_JOB = "adspend-sheet";

export type AccountRunResult = {
  trackerName: string;
  client: string;
  adAccountId: string;
  act: string;
  status: "ok" | "skipped" | "error";
  days: Array<{ dateISO: string; spend: number; currency: string | null }>;
  currency: string | null;
  nonInr: boolean;
  error: string | null;
  metaName: string | null;
  businessAdAccounts: MetaAccountInfo[] | null;
};

export type AdspendSyncResult = {
  fromISO: string;
  toISO: string;
  writeTarget: WriteTarget;
  dryRun: boolean;
  trackerSynced: number;
  skippedNoId: SkippedTrackerRow[];
  accounts: AccountRunResult[];
  desired: Array<DesiredSpendRow & { dateSheet: string; currency: string | null }>;
  rowsUpserted: number;
  updates: number;
  inserts: number;
  appends: number;
  warnings: string[];
  ok: boolean;
  error: string | null;
};

export type SyncAdspendOptions = {
  fromISO?: string;
  toISO?: string;
  dryRun?: boolean;
};

function defaultWindow(): { fromISO: string; toISO: string } {
  const yesterday = addDaysISO(todayISTDateString(), -1);
  return { fromISO: addDaysISO(yesterday, -2), toISO: yesterday };
}

function notesFrom(result: AdspendSyncResult): string | null {
  const parts = [
    ...result.skippedNoId.map(
      (s) => `${s.trackerName || s.clientName || `row ${s.sheetRow}`}: ${s.reason}`
    ),
    ...result.accounts
      .filter((a) => a.status !== "ok")
      .map((a) => `${a.client}: ${a.error ?? a.status}`),
    ...result.warnings
  ];
  return parts.length ? parts.join(" | ") : null;
}

export function adspendRunNotes(result: AdspendSyncResult): string | null {
  return notesFrom(result);
}

export function buildDesiredRows(
  days: string[],
  okClients: Array<{ clientName: string }>,
  spendByClientDate: Map<string, { spend: number; currency: string | null }>
): Array<DesiredSpendRow & { dateSheet: string; currency: string | null }> {
  const desired: Array<DesiredSpendRow & { dateSheet: string; currency: string | null }> = [];
  for (const dateISO of days) {
    for (const row of okClients) {
      const hit = spendByClientDate.get(`${dateISO}\t${row.clientName}`);
      desired.push({
        dateISO,
        dateSheet: isoToSheetDate(dateISO),
        client: row.clientName,
        spend: hit?.spend ?? 0,
        currency: hit?.currency ?? null
      });
    }
  }
  return desired;
}

export function buildAdspendSlackText(result: AdspendSyncResult): string | null {
  const fails = result.accounts.filter((a) => a.status === "error");
  const nonInr = result.accounts.filter((a) => a.nonInr);
  if (!fails.length && !nonInr.length && result.ok) return null;
  const lines: string[] = [];
  if (!result.ok) lines.push(`⚠️ ${ADSPEND_JOB} failed: ${result.error ?? "all accounts failed"}`);
  else lines.push(`${ADSPEND_JOB}: ${result.rowsUpserted} rows on ${result.writeTarget.tab}`);
  for (const a of fails) lines.push(`• ${a.client} (${actId(a.adAccountId)}): ${a.error}`);
  for (const a of nonInr) {
    lines.push(`• ${a.client}: currency ${a.currency} (not INR)`);
  }
  return lines.join("\n");
}

async function maybeListBusinessAccounts(
  adAccountId: string,
  validationError: string
): Promise<{ accounts: MetaAccountInfo[]; errors: string[]; note: string | null }> {
  const shouldProbe =
    adAccountId === MANAN_SUSPECT_BUSINESS_ID ||
    /does not exist|unsupported get request|valid ad account/i.test(validationError);
  if (!shouldProbe) return { accounts: [], errors: [], note: null };
  const listed = await listBusinessAdAccounts(adAccountId);
  const ids = listed.accounts
    .map((a) => `${a.name || "(unnamed)"} act_${a.account_id} (${a.currency || "?"})`)
    .join("; ");
  const note = listed.accounts.length
    ? `${adAccountId} looks like a Business portfolio ID, not an ad account. Visible ad accounts: ${ids}. Put the real act_ ID in Tracker names column B.`
    : `${adAccountId} is not a valid ad account${listed.errors.length ? ` (${listed.errors.join("; ")})` : ""}.`;
  return { accounts: listed.accounts, errors: listed.errors, note };
}

export async function syncAdspendSheet(
  options: SyncAdspendOptions = {}
): Promise<AdspendSyncResult> {
  const window = options.fromISO && options.toISO
    ? { fromISO: options.fromISO, toISO: options.toISO }
    : options.toISO
      ? { fromISO: addDaysISO(options.toISO, -2), toISO: options.toISO }
      : defaultWindow();
  const dryRun = Boolean(options.dryRun);
  const days = eachIsoDay(window.fromISO, window.toISO);

  const trackerValues = await readRange(TRACKER_TAB, "A:C", "FORMATTED_VALUE");
  const parsed = parseTrackerRows(trackerValues);

  const tabs = await listSheetTabs();
  const tabNames = tabs.map((t) => t.title);
  const dataFormula = await readRange(DATA_TAB, "A1:D", "FORMULA");
  const dailyFormula = tabNames.includes(DAILY_TAB)
    ? await readRange(DAILY_TAB, "A1:D", "FORMULA")
    : undefined;
  const writeTarget = resolveWriteTarget({
    dataFormulaValues: dataFormula,
    tabNames,
    dailyFormulaValues: dailyFormula
  });

  const warnings: string[] = [
    ...parsed.skipped
      .filter((s) => s.reason !== "no ad account ID")
      .map((s) => `${s.trackerName}: ${s.reason} (${s.adAccountIdRaw})`)
  ];
  const idOwners = new Map<string, string[]>();
  for (const row of parsed.synced) {
    const list = idOwners.get(row.adAccountId) ?? [];
    list.push(row.clientName);
    idOwners.set(row.adAccountId, list);
  }
  for (const [id, names] of idOwners) {
    if (names.length > 1) {
      warnings.push(
        `Ad account ${id} is used by ${names.join(" and ")} — both will get the same spend. Fix Tracker names column B.`
      );
    }
  }

  const accounts: AccountRunResult[] = [];
  const validated: Array<{ row: TrackerRow; account: MetaAccountInfo }> = [];

  const validations = await mapPool(parsed.synced, META_POOL, async (row) => {
    const v = await validateAdAccount(row.adAccountId);
    return { row, v };
  });

  for (const { row, v } of validations) {
    if (v.ok) {
      validated.push({ row, account: v.account });
      continue;
    }
    const listed = await maybeListBusinessAccounts(row.adAccountId, v.error);
    const error = listed.note ?? v.error;
    warnings.push(`${row.clientName}: ${error}`);
    accounts.push({
      trackerName: row.trackerName,
      client: row.clientName,
      adAccountId: row.adAccountId,
      act: actId(row.adAccountId),
      status: "error",
      days: [],
      currency: null,
      nonInr: false,
      error,
      metaName: null,
      businessAdAccounts: listed.accounts.length ? listed.accounts : null
    });
  }

  const spendResults = await mapPool(validated, META_POOL, async ({ row, account }) => {
    const fetched = await fetchAccountDailySpend(row.adAccountId, window.fromISO, window.toISO);
    return { row, account, fetched };
  });

  const spendByClientDate = new Map<string, { spend: number; currency: string | null }>();

  for (const { row, account, fetched } of spendResults) {
    const currency = account.currency || fetched.days.find((d) => d.currency)?.currency || null;
    const nonInr = Boolean(currency && currency.toUpperCase() !== "INR");
    if (fetched.error) {
      accounts.push({
        trackerName: row.trackerName,
        client: row.clientName,
        adAccountId: row.adAccountId,
        act: actId(row.adAccountId),
        status: "error",
        days: [],
        currency,
        nonInr,
        error: fetched.error,
        metaName: account.name,
        businessAdAccounts: null
      });
      warnings.push(`${row.clientName}: ${fetched.error}`);
      continue;
    }
    const byDate = new Map<string, DaySpend>();
    for (const d of fetched.days) byDate.set(d.dateISO, d);
    const filled = days.map((dateISO) => {
      const hit = byDate.get(dateISO);
      return {
        dateISO,
        spend: hit ? parseSpend(hit.spend) : 0,
        currency: hit?.currency ?? currency
      };
    });
    if (nonInr) {
      warnings.push(`${row.clientName}: account_currency is ${currency}, not INR`);
    }
    for (const d of filled) {
      spendByClientDate.set(`${d.dateISO}\t${row.clientName}`, {
        spend: d.spend,
        currency: d.currency
      });
    }
    accounts.push({
      trackerName: row.trackerName,
      client: row.clientName,
      adAccountId: row.adAccountId,
      act: actId(row.adAccountId),
      status: "ok",
      days: filled,
      currency,
      nonInr,
      error: null,
      metaName: account.name,
      businessAdAccounts: null
    });
  }

  const okClients = parsed.synced.filter((row) =>
    accounts.some((a) => a.client === row.clientName && a.adAccountId === row.adAccountId && a.status === "ok")
  );

  const desired = buildDesiredRows(days, okClients, spendByClientDate);

  const attempted = parsed.synced.length;
  const succeeded = okClients.length;
  const allFailed = attempted > 0 && succeeded === 0;
  const noneConfigured = attempted === 0;

  if (writeTarget.tab === FEED_TAB && !tabNames.includes(FEED_TAB) && !dryRun) {
    await ensureTab(FEED_TAB, ["Date", "Client", "Ad Spent", "Calls Booked"]);
  }

  const targetValues = await readRange(writeTarget.tab, "A:D", "FORMATTED_VALUE").catch((e) => {
    if (dryRun && (writeTarget.tab === FEED_TAB || writeTarget.tab === DAILY_TAB)) {
      return [] as unknown[][];
    }
    throw e;
  });
  const existing = parseExistingRows(targetValues);
  const plan = planUpsert(
    existing,
    desired.map((d) => ({ dateISO: d.dateISO, client: d.client, spend: d.spend }))
  );

  if (!dryRun && !allFailed && !noneConfigured) {
    await applySheetOps({
      tab: writeTarget.tab,
      updates: plan.updates,
      inserts: plan.inserts,
      appends: plan.appends
    });
  }

  const error = noneConfigured
    ? "No ad accounts to sync (Tracker names column B is empty)."
    : allFailed
      ? "All ad accounts failed"
      : null;

  return {
    fromISO: window.fromISO,
    toISO: window.toISO,
    writeTarget,
    dryRun,
    trackerSynced: parsed.synced.length,
    skippedNoId: parsed.skipped.filter((s) => s.reason === "no ad account ID"),
    accounts,
    desired,
    rowsUpserted: allFailed || noneConfigured ? 0 : plan.rowCount,
    updates: plan.updates.length,
    inserts: plan.inserts.reduce((n, op) => n + op.rows.length, 0),
    appends: plan.appends.reduce((n, op) => n + op.rows.length, 0),
    warnings,
    ok: !allFailed && !noneConfigured,
    error
  };
}

export function printDryRun(result: AdspendSyncResult): string {
  const lines = [
    `write tab: ${result.writeTarget.tab} (${result.writeTarget.reason})`,
    `window: ${result.fromISO} .. ${result.toISO} (sheet dates ${isoToSheetDate(result.fromISO)} .. ${isoToSheetDate(result.toISO)})`,
    `tracker synced: ${result.trackerSynced}; no ad account ID: ${result.skippedNoId.length}`,
    `${result.dryRun ? "would" : "wrote"} update ${result.updates}, insert ${result.inserts}, append ${result.appends}`,
    "Date\tClient\tAd Spent\tCalls Booked"
  ];
  for (const row of result.desired) {
    lines.push(`${row.dateSheet}\t${row.client}\t${row.spend}\t`);
  }
  for (const a of result.accounts.filter((x) => x.status !== "ok")) {
    lines.push(`# ${a.client}: ${a.error}`);
  }
  for (const s of result.skippedNoId) {
    lines.push(`# ${s.trackerName || s.clientName}: no ad account ID`);
  }
  return lines.join("\n");
}
