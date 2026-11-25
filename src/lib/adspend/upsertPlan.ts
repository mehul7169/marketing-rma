import { dateClientKey, isoToSheetDate, sheetDateToIso } from "@/lib/adspend/dates";
import { looksLikeHeaderRow } from "@/lib/adspend/detectWriteTab";

export type DesiredSpendRow = {
  dateISO: string;
  client: string;
  spend: number;
};

export type ExistingSheetRow = {
  rowNumber: number;
  dateISO: string | null;
  dateRaw: string;
  client: string;
  spendRaw: string;
};

export type UpdateOp = {
  kind: "update";
  rowNumber: number;
  dateISO: string;
  client: string;
  spend: number;
  previousSpendRaw: string;
};

export type InsertOp = {
  kind: "insert";
  /** 1-based row after which to insert (0 = before row 1). */
  afterRow: number;
  rows: Array<DesiredSpendRow & { dateSheet: string }>;
};

export type AppendOp = {
  kind: "append";
  rows: Array<DesiredSpendRow & { dateSheet: string }>;
};

export type UpsertPlan = {
  updates: UpdateOp[];
  inserts: InsertOp[];
  appends: AppendOp[];
  rowCount: number;
};

export function parseExistingRows(values: unknown[][]): ExistingSheetRow[] {
  const out: ExistingSheetRow[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const rowNumber = i + 1;
    const row = values[i] ?? [];
    if (i === 0 && looksLikeHeaderRow(row)) continue;
    const dateRaw = String(row[0] ?? "").trim();
    const client = String(row[1] ?? "").trim();
    if (!dateRaw && !client) continue;
    out.push({
      rowNumber,
      dateISO: sheetDateToIso(dateRaw),
      dateRaw,
      client,
      spendRaw: String(row[2] ?? "").trim()
    });
  }
  return out;
}

function withSheetDate(row: DesiredSpendRow): DesiredSpendRow & { dateSheet: string } {
  return { ...row, dateSheet: isoToSheetDate(row.dateISO) };
}

/**
 * Match on (Date, Client). Update column C only when the row exists.
 * New dates append in tracker order. Missing clients for an existing date
 * insert after that date's last row so grouping stays intact.
 */
export function planUpsert(
  existing: ExistingSheetRow[],
  desired: DesiredSpendRow[]
): UpsertPlan {
  const byKey = new Map<string, ExistingSheetRow>();
  const lastRowByDate = new Map<string, number>();
  for (const row of existing) {
    if (!row.dateISO || !row.client) continue;
    byKey.set(dateClientKey(row.dateISO, row.client), row);
    const prev = lastRowByDate.get(row.dateISO) ?? 0;
    if (row.rowNumber > prev) lastRowByDate.set(row.dateISO, row.rowNumber);
  }

  const updates: UpdateOp[] = [];
  const missingByDate = new Map<string, DesiredSpendRow[]>();

  for (const row of desired) {
    const hit = byKey.get(dateClientKey(row.dateISO, row.client));
    if (hit) {
      updates.push({
        kind: "update",
        rowNumber: hit.rowNumber,
        dateISO: row.dateISO,
        client: row.client,
        spend: row.spend,
        previousSpendRaw: hit.spendRaw
      });
      continue;
    }
    const list = missingByDate.get(row.dateISO) ?? [];
    list.push(row);
    missingByDate.set(row.dateISO, list);
  }

  const inserts: InsertOp[] = [];
  const appendRows: Array<DesiredSpendRow & { dateSheet: string }> = [];
  const dates = [...missingByDate.keys()].sort();
  for (const dateISO of dates) {
    const rows = (missingByDate.get(dateISO) ?? []).map(withSheetDate);
    const afterRow = lastRowByDate.get(dateISO);
    if (afterRow) inserts.push({ kind: "insert", afterRow, rows });
    else appendRows.push(...rows);
  }

  const appends: AppendOp[] = appendRows.length ? [{ kind: "append", rows: appendRows }] : [];
  const rowCount =
    updates.length +
    inserts.reduce((n, op) => n + op.rows.length, 0) +
    appends.reduce((n, op) => n + op.rows.length, 0);

  return { updates, inserts, appends, rowCount };
}
