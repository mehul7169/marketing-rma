import { toISTDateString, formatCalendarDate } from "@/lib/timezone";

function parseCivil(iso: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Invalid date: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function formatCivil(year: number, month: number, day: number): string {
  const dt = new Date(Date.UTC(year, month - 1, day));
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** IST calendar date (YYYY-MM-DD) of a UTC instant. */
export function toISODate(d: Date): string {
  return toISTDateString(d);
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = parseCivil(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

export function clampDateRange(fromISO: string, toISO: string): { fromISO: string; toISO: string } {
  parseCivil(fromISO);
  parseCivil(toISO);
  if (fromISO > toISO) return { fromISO: toISO, toISO: fromISO };
  return { fromISO, toISO };
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = parseCivil(iso);
  return formatCivil(y, m, d + days);
}

/** Inclusive day count between two YYYY-MM-DD calendar dates. */
export function inclusiveDayCount(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = parseCivil(fromISO);
  const [y2, m2, d2] = parseCivil(toISO);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000) + 1;
}

/** Prior period of the same length, ending the day before `fromISO`. */
export function getPriorPeriod(
  fromISO: string,
  toISO: string
): { fromISO: string; toISO: string; periodDays: number } {
  const periodDays = inclusiveDayCount(fromISO, toISO);
  const priorTo = addDaysISO(fromISO, -1);
  const priorFrom = addDaysISO(priorTo, -(periodDays - 1));
  return { fromISO: priorFrom, toISO: priorTo, periodDays };
}

/** Fill missing calendar days in a trend series (zeros for gaps). */
export function fillTrendDateGaps<T extends { date: string }>(
  points: T[],
  fromISO: string,
  toISO: string,
  emptyValue: Omit<T, "date">
): T[] {
  const byDate = new Map(points.map((p) => [p.date, p]));
  const filled: T[] = [];
  let cursor = fromISO;

  while (cursor <= toISO) {
    filled.push(byDate.get(cursor) ?? ({ ...emptyValue, date: cursor } as T));
    cursor = addDaysISO(cursor, 1);
  }

  return filled;
}

/** Recharts XAxis interval: 0 = every tick, N = show every (N+1)th tick. */
export function getChartTickInterval(rangeDays: number): number {
  if (rangeDays <= 14) return 0;
  if (rangeDays <= 31) return 2;
  if (rangeDays <= 90) return 6;
  return Math.max(0, Math.floor(rangeDays / 12) - 1);
}

/** Short label for a YYYY-MM-DD calendar date — e.g. "12 Aug". */
export function formatChartDateLabel(iso: string): string {
  return formatCalendarDate(iso, "d MMM");
}
