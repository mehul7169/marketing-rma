import { addDays, format, parseISO } from "date-fns";

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

