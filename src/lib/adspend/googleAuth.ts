import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

export function getGoogleServiceAccountJson(): string {
  const raw =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.GA4_SERVICE_ACCOUNT_JSON?.trim() ||
    "";
  if (!raw) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_JSON (or GA4_SERVICE_ACCOUNT_JSON to reuse)"
    );
  }
  return raw;
}

export function parseGoogleServiceAccount(
  json: string = getGoogleServiceAccountJson()
): GoogleServiceAccount {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const client_email = String(parsed.client_email ?? "").trim();
  const private_key = String(parsed.private_key ?? "");
  const project_id =
    typeof parsed.project_id === "string" ? parsed.project_id : undefined;
  if (!client_email || !private_key) {
    throw new Error("Service account JSON is missing client_email or private_key");
  }
  return { client_email, private_key, project_id };
}

/** Master AdSpend spreadsheet. Not a secret; optional ADSPEND_SHEET_ID overrides. */
export const DEFAULT_ADSPEND_SHEET_ID =
  "1ILFmTXoFeSCXKb1lMFuX3xvJiuN-QSv063KQQplhVAY";

export function getAdspendSheetId(): string {
  return process.env.ADSPEND_SHEET_ID?.trim() || DEFAULT_ADSPEND_SHEET_ID;
}

export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const sa = parseGoogleServiceAccount();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: [SHEETS_SCOPE]
  });
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}
