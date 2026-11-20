import type { LeadRow } from "@/lib/leads/types";
import {
  addIstCalendarDays,
  formatIST,
  formatLastTriedFriendly,
  IST_TIMEZONE,
  toISTDateString,
  utcToZonedTime
} from "@/lib/timezone";
import { format } from "date-fns/format";

export const DEAL_OPEN_GROUPS = [
  "overdue",
  "needs_next_step",
  "today",
  "tomorrow",
  "this_week",
  "later"
] as const;
export type DealOpenGroupId = (typeof DEAL_OPEN_GROUPS)[number];

export const DEAL_OPEN_GROUP_LABELS: Record<DealOpenGroupId, string> = {
  overdue: "Overdue",
  needs_next_step: "Needs next step",
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This week",
  later: "Later"
};

export type DealOpenGroup = {
  id: DealOpenGroupId;
  label: string;
  rows: LeadRow[];
};

function asDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

export function needsNextStep(
  lead: Pick<LeadRow, "next_step" | "next_action_at">
): boolean {
  return !lead.next_step?.trim() || !lead.next_action_at;
}

/** Inclusive IST Sunday of the week containing `now`. */
export function istWeekEndDateString(now: Date | string): string {
  const zoned = utcToZonedTime(asDate(now), IST_TIMEZONE);
  const isoDay = Number(format(zoned, "i")); // 1 Mon … 7 Sun
  const today = toISTDateString(now);
  return addIstCalendarDays(today, 7 - isoDay);
}

export function classifyOpenDeal(
  lead: Pick<LeadRow, "next_step" | "next_action_at">,
  now: Date | string = new Date()
): DealOpenGroupId {
  if (needsNextStep(lead)) return "needs_next_step";
  const due = asDate(lead.next_action_at!);
  if (due.getTime() < asDate(now).getTime()) return "overdue";
  const today = toISTDateString(now);
  const tomorrow = addIstCalendarDays(today, 1);
  const day = toISTDateString(due);
  if (day === today) return "today";
  if (day === tomorrow) return "tomorrow";
  if (day <= istWeekEndDateString(now)) return "this_week";
  return "later";
}

function showedAt(lead: LeadRow): number {
  return lead.call_showed_at ? Date.parse(lead.call_showed_at) : 0;
}

function dueAt(lead: LeadRow): number {
  return lead.next_action_at ? Date.parse(lead.next_action_at) : 0;
}

function sortGroup(id: DealOpenGroupId, rows: LeadRow[]): LeadRow[] {
  const copy = [...rows];
  if (id === "overdue") {
    copy.sort((a, b) => dueAt(a) - dueAt(b) || showedAt(b) - showedAt(a));
  } else if (id === "needs_next_step") {
    copy.sort((a, b) => showedAt(b) - showedAt(a));
  } else {
    copy.sort((a, b) => dueAt(a) - dueAt(b) || showedAt(b) - showedAt(a));
  }
  return copy;
}

export function groupOpenDeals(
  leads: LeadRow[],
  now: Date | string = new Date()
): DealOpenGroup[] {
  const buckets = new Map<DealOpenGroupId, LeadRow[]>();
  for (const id of DEAL_OPEN_GROUPS) buckets.set(id, []);
  for (const lead of leads) {
    buckets.get(classifyOpenDeal(lead, now))!.push(lead);
  }
  return DEAL_OPEN_GROUPS.map((id) => ({
    id,
    label: DEAL_OPEN_GROUP_LABELS[id],
    rows: sortGroup(id, buckets.get(id)!)
  })).filter((g) => g.rows.length > 0);
}

/** Row due label: "Today 4:00 PM" / "Yesterday 4:00 PM". */
export function formatDealDueAt(
  date: Date | string | null | undefined,
  now: Date | string = new Date()
): string {
  if (!date) return "No due date";
  const d = asDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  const zoned = utcToZonedTime(d, IST_TIMEZONE);
  const today = utcToZonedTime(asDate(now), IST_TIMEZONE);
  const zonedDay = new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayDiff = Math.round((zonedDay.getTime() - todayDay.getTime()) / 86400000);
  const time = format(zoned, "h:mm a");
  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Tomorrow ${time}`;
  if (dayDiff === -1) return `Yesterday ${time}`;
  if (dayDiff > 1 && dayDiff <= 6) return `${format(zoned, "EEEE")} ${time}`;
  return `${formatIST(d, "d MMM")} ${time}`;
}

export function formatShowedDate(date: string | null | undefined): string {
  if (!date) return "";
  return `Showed ${formatIST(date, "d MMM")}`;
}

/** "2 days ago · Neha · Wants monthly plan" — one line, caller truncates. */
export function formatLastTouch(opts: {
  last_action_at: string | null;
  last_action: string | null;
  note?: string | null;
  actorEmail?: string | null;
}): string {
  const when = opts.last_action_at ? formatLastTriedFriendly(opts.last_action_at) : "";
  const actor = opts.actorEmail ? actorDisplayName(opts.actorEmail) : "";
  const note = (opts.note || opts.last_action || "").replace(/\s+/g, " ").trim();
  return [when, actor, note].filter(Boolean).join(" · ");
}

export function actorDisplayName(email: string | null | undefined): string {
  if (!email?.trim()) return "—";
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

export function whatsappHref(phone: string | null | undefined): string | null {
  const digits = phoneDigits(phone);
  return digits ? `https://wa.me/${digits}` : null;
}

export type DealMetrics = {
  overdue: number;
  dueToday: number;
  needsNextStep: number;
  wonThisMonth: number;
  wonThisMonthValue: number;
};

export function computeDealMetrics(
  openDeals: LeadRow[],
  wonDealsThisMonth: LeadRow[],
  now: Date | string = new Date()
): DealMetrics {
  let overdue = 0;
  let dueToday = 0;
  let needs = 0;
  for (const lead of openDeals) {
    const g = classifyOpenDeal(lead, now);
    if (g === "overdue") overdue += 1;
    else if (g === "today") dueToday += 1;
    else if (g === "needs_next_step") needs += 1;
  }
  let value = 0;
  for (const lead of wonDealsThisMonth) value += lead.deal_value ?? 0;
  return {
    overdue,
    dueToday,
    needsNextStep: needs,
    wonThisMonth: wonDealsThisMonth.length,
    wonThisMonthValue: value
  };
}

/** First IST calendar day of the month containing `now`. */
export function istMonthStartDateString(now: Date | string = new Date()): string {
  return formatIST(now, "yyyy-MM-01");
}
