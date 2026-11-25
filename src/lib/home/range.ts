import { addIstCalendarDays, todayISTDateString } from "@/lib/timezone";
import { addDaysISO, inclusiveDayCount } from "@/lib/utils/date";

export const HOME_RANGES = ["today", "7d", "30d", "month", "all"] as const;
export type HomeRangeId = (typeof HOME_RANGES)[number];

export const HOME_TRAFFIC = ["all", "paid", "organic"] as const;
export type HomeTrafficId = (typeof HOME_TRAFFIC)[number];

export const HOME_RANGE_OPTIONS: Array<{ value: HomeRangeId; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "month", label: "Month" },
  { value: "all", label: "All" }
];

export const HOME_TRAFFIC_OPTIONS: Array<{
  value: HomeTrafficId;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "organic", label: "Organic" }
];

export const DEFAULT_HOME_RANGE: HomeRangeId = "30d";
export const DEFAULT_HOME_TRAFFIC: HomeTrafficId = "all";

/** Far-past IST day for the All preset. */
export const HOME_ALL_FROM = "2020-01-01";

export function parseHomeRange(raw?: string | null): HomeRangeId {
  if (raw && (HOME_RANGES as readonly string[]).includes(raw)) {
    return raw as HomeRangeId;
  }
  return DEFAULT_HOME_RANGE;
}

export function parseHomeTraffic(raw?: string | null): HomeTrafficId {
  if (raw && (HOME_TRAFFIC as readonly string[]).includes(raw)) {
    return raw as HomeTrafficId;
  }
  return DEFAULT_HOME_TRAFFIC;
}

export function istMonthStart(dayISO: string): string {
  return `${dayISO.slice(0, 7)}-01`;
}

export function istMonthEnd(dayISO: string): string {
  const [y, m] = dayISO.split("-").map(Number) as [number, number];
  const nextMonth =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return addDaysISO(nextMonth, -1);
}

export function rangeToFromTo(
  range: HomeRangeId,
  todayISO: string = todayISTDateString()
): { fromISO: string; toISO: string } {
  if (range === "today") return { fromISO: todayISO, toISO: todayISO };
  if (range === "7d") {
    return { fromISO: addIstCalendarDays(todayISO, -6), toISO: todayISO };
  }
  if (range === "month") {
    return { fromISO: istMonthStart(todayISO), toISO: todayISO };
  }
  if (range === "all") return { fromISO: HOME_ALL_FROM, toISO: todayISO };
  return { fromISO: addIstCalendarDays(todayISO, -29), toISO: todayISO };
}

export type TrendBucket = "day" | "week" | "month";

/** Daily ≤30 days, weekly for longer presets, monthly for All. */
export function trendBucketFor(
  range: HomeRangeId,
  fromISO: string,
  toISO: string
): TrendBucket {
  if (range === "all") return "month";
  if (inclusiveDayCount(fromISO, toISO) <= 30) return "day";
  return "week";
}

/** Monday of the IST week containing `dayISO`. */
export function istWeekStart(dayISO: string): string {
  const [y, m, d] = dayISO.split("-").map(Number) as [number, number, number];
  const utc = Date.UTC(y, m - 1, d);
  const weekday = new Date(utc).getUTCDay(); // 0 Sun … 6 Sat
  const back = weekday === 0 ? 6 : weekday - 1;
  return addDaysISO(dayISO, -back);
}

export function bucketKey(
  dayISO: string,
  bucket: TrendBucket
): string {
  if (bucket === "month") return dayISO.slice(0, 7);
  if (bucket === "week") return istWeekStart(dayISO);
  return dayISO;
}

export function iterateBucketKeys(
  fromISO: string,
  toISO: string,
  bucket: TrendBucket
): string[] {
  const keys: string[] = [];
  if (bucket === "day") {
    let cursor = fromISO;
    while (cursor <= toISO) {
      keys.push(cursor);
      cursor = addDaysISO(cursor, 1);
    }
    return keys;
  }
  if (bucket === "week") {
    let cursor = istWeekStart(fromISO);
    const last = istWeekStart(toISO);
    while (cursor <= last) {
      keys.push(cursor);
      cursor = addDaysISO(cursor, 7);
    }
    return keys;
  }
  let y = Number(fromISO.slice(0, 4));
  let m = Number(fromISO.slice(5, 7));
  const endY = Number(toISO.slice(0, 4));
  const endM = Number(toISO.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

export function homeHref(opts: {
  range?: HomeRangeId;
  traffic?: HomeTrafficId;
}): string {
  const params = new URLSearchParams();
  const range = opts.range ?? DEFAULT_HOME_RANGE;
  const traffic = opts.traffic ?? DEFAULT_HOME_TRAFFIC;
  if (range !== DEFAULT_HOME_RANGE) params.set("range", range);
  if (traffic !== DEFAULT_HOME_TRAFFIC) params.set("traffic", traffic);
  const q = params.toString();
  return q ? `/?${q}` : "/";
}
