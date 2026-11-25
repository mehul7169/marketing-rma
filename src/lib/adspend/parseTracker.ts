/**
 * Tracker names tab: A = tracker name, B = bare numeric ad account id, C = Client.
 * Column B must stay a digit string — never Number() (16-digit ids lose precision).
 */

export const AD_ACCOUNT_ID_RE = /^\d+$/;

export type TrackerRow = {
  sheetRow: number;
  trackerName: string;
  /** Digits only, no act_ prefix. */
  adAccountId: string;
  clientName: string;
};

export type SkippedTrackerRow = {
  sheetRow: number;
  trackerName: string;
  clientName: string;
  adAccountIdRaw: string;
  reason: "no ad account ID" | "invalid ad account ID" | "missing client name";
};

export type ParsedTracker = {
  synced: TrackerRow[];
  skipped: SkippedTrackerRow[];
};

function cell(row: unknown[] | undefined, i: number): string {
  if (!row || i >= row.length || row[i] == null) return "";
  return String(row[i]).trim();
}

export function parseAdAccountId(raw: string): string | null {
  const id = raw.trim();
  if (!id) return null;
  if (!AD_ACCOUNT_ID_RE.test(id)) return null;
  return id;
}

export function actId(adAccountId: string): string {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

export function matchesClientFilter(
  row: Pick<TrackerRow, "clientName" | "trackerName">,
  filters: string[]
): boolean {
  if (!filters.length) return true;
  return filters.some((raw) => {
    const q = raw.trim().toLowerCase();
    if (!q) return false;
    return (
      row.clientName.trim().toLowerCase().includes(q) ||
      row.trackerName.trim().toLowerCase().includes(q)
    );
  });
}

export function parseTrackerRows(values: unknown[][]): ParsedTracker {
  const synced: TrackerRow[] = [];
  const skipped: SkippedTrackerRow[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < values.length; i += 1) {
    const sheetRow = i + 1;
    if (i === 0) continue;
    const trackerName = cell(values[i], 0);
    const adAccountIdRaw = cell(values[i], 1);
    const clientName = cell(values[i], 2);
    if (!trackerName && !adAccountIdRaw && !clientName) continue;

    if (!adAccountIdRaw) {
      skipped.push({
        sheetRow,
        trackerName,
        clientName,
        adAccountIdRaw,
        reason: "no ad account ID"
      });
      continue;
    }

    const adAccountId = parseAdAccountId(adAccountIdRaw);
    if (!adAccountId) {
      skipped.push({
        sheetRow,
        trackerName,
        clientName,
        adAccountIdRaw,
        reason: "invalid ad account ID"
      });
      continue;
    }

    if (!clientName) {
      skipped.push({
        sheetRow,
        trackerName,
        clientName,
        adAccountIdRaw,
        reason: "missing client name"
      });
      continue;
    }

    const key = `${adAccountId}\t${clientName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    synced.push({ sheetRow, trackerName, adAccountId, clientName });
  }

  return { synced, skipped };
}
