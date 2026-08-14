import { format } from "date-fns/format";
import { fromZonedTime } from "date-fns-tz/fromZonedTime";
import { toZonedTime } from "date-fns-tz/toZonedTime";

/** All display and day-bucketing in this app is Asia/Kolkata. Storage stays UTC. */
export const IST_TIMEZONE = "Asia/Kolkata";

export const IST_DATETIME_FORMAT = "d MMM yyyy, HH:mm";

function asDate(date: Date | string): Date {
  return typeof date === "string" ? new Date(date) : date;
}

/** date-fns-tz v3 names; v2 called these utcToZonedTime / zonedTimeToUtc. */
export const utcToZonedTime = toZonedTime;
export const zonedTimeToUtc = fromZonedTime;

/** Format a UTC instant as an IST date/time string. */
export function formatIST(date: Date | string, formatStr: string): string {
  return format(toZonedTime(asDate(date), IST_TIMEZONE), formatStr);
}

/**
 * IST calendar date (YYYY-MM-DD) for a UTC instant.
 * Do not use `toISOString().split("T")[0]` — that is the UTC date and will
 * put 12:15am IST on the previous day.
 */
export function toISTDateString(date: Date | string): string {
  return formatIST(date, "yyyy-MM-dd");
}

/** Current instant. Pair with toISTDateString() for "today" in IST. */
export function nowInIST(): Date {
  return new Date();
}

export function todayISTDateString(): string {
  return toISTDateString(nowInIST());
}

/** Start of an IST calendar day, as a UTC ISO string for timestamptz filters. */
export function istDayStartUtcIso(yyyyMmDd: string): string {
  return fromZonedTime(`${yyyyMmDd}T00:00:00`, IST_TIMEZONE).toISOString();
}

/** Inclusive end of an IST calendar day, as a UTC ISO string. */
export function istDayEndUtcIso(yyyyMmDd: string): string {
  return fromZonedTime(`${yyyyMmDd}T23:59:59.999`, IST_TIMEZONE).toISOString();
}

/** Display helper for CRM/dashboard timestamps. Empty/invalid → em dash. */
export function formatISTDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = asDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  return formatIST(d, IST_DATETIME_FORMAT);
}

/**
 * Format a YYYY-MM-DD calendar date (already an IST or API reporting day)
 * without shifting it through the server/browser timezone.
 */
export function formatCalendarDate(yyyyMmDd: string, formatStr = "d MMM"): string {
  return formatIST(fromZonedTime(`${yyyyMmDd}T00:00:00`, IST_TIMEZONE), formatStr);
}
