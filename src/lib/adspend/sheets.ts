import type { sheets_v4 } from "googleapis";
import { getAdspendSheetId, getSheetsClient, parseGoogleServiceAccount } from "@/lib/adspend/googleAuth";
import type { AppendOp, InsertOp, UpdateOp } from "@/lib/adspend/upsertPlan";

export type SheetTabInfo = {
  title: string;
  sheetId: number;
};

function a1(tab: string, range: string): string {
  return `'${tab.replace(/'/g, "''")}'!${range}`;
}

export function shareSheetHint(): string {
  const sa = parseGoogleServiceAccount();
  return (
    `Share the Master AdSpend sheet with ${sa.client_email} as Editor ` +
    `(GCP project ${sa.project_id ?? "automatic-opus-505310-u6"}). ` +
    `Format Tracker names column B as Plain text so 16-digit IDs are not rounded.`
  );
}

function wrapSheetsError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (/permission|403|forbidden/i.test(msg)) {
    throw new Error(`${msg}. ${shareSheetHint()}`);
  }
  throw e instanceof Error ? e : new Error(msg);
}

export async function listSheetTabs(
  sheets?: sheets_v4.Sheets,
  spreadsheetId = getAdspendSheetId()
): Promise<SheetTabInfo[]> {
  const client = sheets ?? (await getSheetsClient());
  try {
    const meta = await client.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties"
    });
    return (meta.data.sheets ?? [])
      .map((s) => ({
        title: s.properties?.title ?? "",
        sheetId: s.properties?.sheetId ?? -1
      }))
      .filter((s) => s.title && s.sheetId >= 0);
  } catch (e) {
    wrapSheetsError(e);
  }
}

export async function readRange(
  tab: string,
  range: string,
  valueRenderOption: "FORMULA" | "FORMATTED_VALUE" | "UNFORMATTED_VALUE",
  sheets?: sheets_v4.Sheets,
  spreadsheetId = getAdspendSheetId()
): Promise<unknown[][]> {
  const client = sheets ?? (await getSheetsClient());
  try {
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: a1(tab, range),
      valueRenderOption
    });
    return (res.data.values as unknown[][] | undefined) ?? [];
  } catch (e) {
    wrapSheetsError(e);
  }
}

export async function ensureTab(
  title: string,
  headers: string[],
  sheets?: sheets_v4.Sheets,
  spreadsheetId = getAdspendSheetId()
): Promise<SheetTabInfo> {
  const client = sheets ?? (await getSheetsClient());
  const tabs = await listSheetTabs(client, spreadsheetId);
  const hit = tabs.find((t) => t.title === title);
  if (hit) return hit;
  try {
    const res = await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }]
      }
    });
    const sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (sheetId == null) throw new Error(`Failed to create tab ${title}`);
    if (headers.length) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: a1(title, "A1"),
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [headers] }
      });
    }
    return { title, sheetId };
  } catch (e) {
    wrapSheetsError(e);
  }
}

function writeRow(dateSheet: string, client: string, spend: number): unknown[] {
  return [dateSheet, client, spend, ""];
}

export async function applySheetOps(opts: {
  tab: string;
  updates: UpdateOp[];
  inserts: InsertOp[];
  appends: AppendOp[];
  sheets?: sheets_v4.Sheets;
  spreadsheetId?: string;
}): Promise<void> {
  const spreadsheetId = opts.spreadsheetId ?? getAdspendSheetId();
  const client = opts.sheets ?? (await getSheetsClient());
  try {
    const tabs = await listSheetTabs(client, spreadsheetId);
    const tabInfo = tabs.find((t) => t.title === opts.tab);
    if (!tabInfo) throw new Error(`Missing tab ${opts.tab}`);

    if (opts.updates.length) {
      await client.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: opts.updates.map((op) => ({
            range: a1(opts.tab, `C${op.rowNumber}`),
            values: [[op.spend]]
          }))
        }
      });
    }

    // Insert from the bottom so earlier afterRow indexes stay valid.
    const inserts = [...opts.inserts].sort((a, b) => b.afterRow - a.afterRow);
    for (const op of inserts) {
      if (op.rows.length === 0) continue;
      const startIndex = op.afterRow;
      await client.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: tabInfo.sheetId,
                  dimension: "ROWS",
                  startIndex,
                  endIndex: startIndex + op.rows.length
                },
                inheritFromBefore: true
              }
            }
          ]
        }
      });
      const firstRow = startIndex + 1;
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: a1(opts.tab, `A${firstRow}:D${firstRow + op.rows.length - 1}`),
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: op.rows.map((r) => writeRow(r.dateSheet, r.client, r.spend))
        }
      });
    }

    for (const op of opts.appends) {
      if (op.rows.length === 0) continue;
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: a1(opts.tab, "A:D"),
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: op.rows.map((r) => writeRow(r.dateSheet, r.client, r.spend))
        }
      });
    }
  } catch (e) {
    wrapSheetsError(e);
  }
}
