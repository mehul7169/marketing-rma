/** Sheet dates are dd/mm/yyyy (IST). Never treat them as US mm/dd. */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHEET = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function isoToSheetDate(iso: string): string {
  const m = ISO.exec(iso.trim());
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function sheetDateToIso(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (ISO.test(t)) return t;
  const m = SHEET.exec(t);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

export function eachIsoDay(fromISO: string, toISO: string): string[] {
  if (!ISO.test(fromISO) || !ISO.test(toISO)) {
    throw new Error(`Invalid ISO range: ${fromISO}..${toISO}`);
  }
  const out: string[] = [];
  let cur = fromISO;
  while (cur <= toISO) {
    out.push(cur);
    const [y, m, d] = cur.split("-").map((p) => Number(p));
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const yyyy = String(next.getUTCFullYear());
    const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(next.getUTCDate()).padStart(2, "0");
    cur = `${yyyy}-${mm}-${dd}`;
  }
  return out;
}

export function dateClientKey(dateISO: string, client: string): string {
  return `${dateISO}\t${client}`;
}
