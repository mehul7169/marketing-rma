import { addDays, differenceInDays, format, parseISO } from "date-fns";

export function toISODate(d: Date): string {
  // Use calendar date (YYYY-MM-DD) in UTC to avoid server TZ drift.
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return format(utc, "yyyy-MM-dd");
}

export function parseISODate(iso: string): Date {
  // `parseISO` interprets YYYY-MM-DD as UTC midnight in practice.
  return parseISO(iso);
}

export function clampDateRange(fromISO: string, toISO: string): { fromISO: string; toISO: string } {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range");
  }
  if (from > to) return { fromISO: toISO, toISO: fromISO };
  return { fromISO, toISO };
}

export function addDaysISO(iso: string, days: number): string {
  return toISODate(addDays(parseISODate(iso), days));
}

/** Inclusive day count between two ISO dates. */
export function inclusiveDayCount(fromISO: string, toISO: string): number {
  return differenceInDays(parseISODate(toISO), parseISODate(fromISO)) + 1;
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

/** Short label for chart x-axis — e.g. "12 Aug". */
export function formatChartDateLabel(iso: string): string {
  return format(parseISODate(iso), "d MMM");
}

