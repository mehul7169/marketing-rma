/**
 * All display and day-bucketing in this app is Asia/Kolkata.
 * Storage stays UTC (timestamptz / ISO strings).
 *
 * Formatting uses Intl with timeZone: Asia/Kolkata (not the server or browser
 * locale, and not UTC date slicing). India does not observe DST; IST day
 * bounds are converted to UTC with the fixed +05:30 offset via Date.UTC so
 * calendar rollover is handled by the Date constructor.
 */

export const IST_TIMEZONE = "Asia/Kolkata";

export const IST_DATETIME_FORMAT = "d MMM yyyy, HH:mm";

/** IST is UTC+5:30 with no DST. Used only to convert IST civil times to UTC. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function asDate(date: Date | string): Date {
  return typeof date === "string" ? new Date(date) : date;
}

function istParts(date: Date): {
  year: string;
  month: string;
  monthShort: string;
  day: string;
  hour: string;
  minute: string;
} {
  const numeric = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const monthShortFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    month: "short"
  });

  const map: Record<string, string> = {};
  for (const p of numeric.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const monthPart = monthShortFmt.formatToParts(date).find((p) => p.type === "month");

  return {
    year: map.year,
    month: map.month,
    monthShort: monthPart?.value ?? map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute
  };
}

/** Format a UTC instant as an IST date/time string. */
export function formatIST(date: Date | string, formatStr: string): string {
  const p = istParts(asDate(date));
  const day = String(Number(p.day));
  switch (formatStr) {
    case "yyyy-MM-dd":
      return `${p.year}-${p.month}-${p.day}`;
    case "d MMM":
      return `${day} ${p.monthShort}`;
    case "d MMM yyyy":
      return `${day} ${p.monthShort} ${p.year}`;
    case "d MMM yyyy, HH:mm":
      return `${day} ${p.monthShort} ${p.year}, ${p.hour}:${p.minute}`;
    default:
      throw new Error(`Unsupported IST format string: ${formatStr}`);
  }
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

/**
 * Interpret a civil date/time in IST and return the UTC ISO string.
 * Date.UTC + a fixed offset (no DST) so 00:00 IST on the 1st still lands
 * on the previous UTC calendar day correctly.
 */
function istCivilToUtcIso(
  yyyyMmDd: string,
  hours: number,
  minutes: number,
  seconds: number,
  ms: number
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!match) throw new Error(`Invalid date: ${yyyyMmDd}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const asIfUtc = Date.UTC(year, month - 1, day, hours, minutes, seconds, ms);
  return new Date(asIfUtc - IST_OFFSET_MS).toISOString();
}

/** Start of an IST calendar day, as a UTC ISO string for timestamptz filters. */
export function istDayStartUtcIso(yyyyMmDd: string): string {
  return istCivilToUtcIso(yyyyMmDd, 0, 0, 0, 0);
}

/** Inclusive end of an IST calendar day, as a UTC ISO string. */
export function istDayEndUtcIso(yyyyMmDd: string): string {
  return istCivilToUtcIso(yyyyMmDd, 23, 59, 59, 999);
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
  return formatIST(`${yyyyMmDd}T00:00:00+05:30`, formatStr);
}
