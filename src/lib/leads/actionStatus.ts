import {
  IST_TIMEZONE,
  toISTDateString,
  todayISTDateString,
  utcToZonedTime,
  zonedTimeToUtc
} from "@/lib/timezone";

/** Stored + displayed action_status values. Null on leads means Untouched. */
export const ACTION_STATUSES = [
  "Closed",
  "Dead",
  "Follow-up Overdue",
  "Follow-up Due",
  "Personally Contacted",
  "Qualified Call Booked",
  "Call Booked",
  "Untouched"
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

export type CallAttemptOutcome =
  | "no_answer"
  | "follow_up_needed"
  | "qualified"
  | "not_qualified"
  | "confirmed"
  | "not_confirmed";

export type ShowOutcome = "showed" | "no_show";

export type LeadActivityType =
  | "call_attempt"
  | "whatsapp_sent"
  | "reschedule"
  | "revive"
  | "note"
  | "show_outcome";

/** Default calling windows (IST): Morning / Afternoon / Evening. */
export const TOUCHPOINT_HOURS_IST = [10, 13, 16] as const;

export function displayActionStatus(
  actionStatus: string | null | undefined
): ActionStatus {
  if (!actionStatus) return "Untouched";
  if ((ACTION_STATUSES as readonly string[]).includes(actionStatus)) {
    return actionStatus as ActionStatus;
  }
  return "Untouched";
}

export function inferLastCallOutcome(
  lastAction: string | null | undefined
): CallAttemptOutcome | null {
  if (!lastAction) return null;
  if (/no answer/i.test(lastAction)) return "no_answer";
  if (/follow-?up needed/i.test(lastAction)) return "follow_up_needed";
  if (/not qualified/i.test(lastAction)) return "not_qualified";
  if (/not confirmed/i.test(lastAction)) return "not_confirmed";
  if (/qualified/i.test(lastAction)) return "qualified";
  if (/confirmed/i.test(lastAction)) return "confirmed";
  return null;
}

export function callAttemptSummary(outcome: CallAttemptOutcome): string {
  switch (outcome) {
    case "no_answer":
      return "Called — No Answer";
    case "follow_up_needed":
      return "Called — Follow-up Needed";
    case "qualified":
      return "Called — Qualified";
    case "not_qualified":
      return "Called — Unqualified";
    case "confirmed":
      return "Called — Confirmed";
    case "not_confirmed":
      return "Called — Not Confirmed";
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function istWallToUtcIso(
  year: number,
  monthIndex: number,
  day: number,
  hour: number
): string {
  const wall = `${year}-${pad2(monthIndex + 1)}-${pad2(day)}T${pad2(hour)}:00:00`;
  return zonedTimeToUtc(wall, IST_TIMEZONE).toISOString();
}

/**
 * Next Morning/Afternoon/Evening window after `from` (default now), as UTC ISO.
 * Windows: 10:00 / 13:00 / 16:00 Asia/Kolkata.
 */
export function nextTouchpointAt(from: Date = new Date()): string {
  const zoned = utcToZonedTime(from, IST_TIMEZONE);
  const y = zoned.getFullYear();
  const m = zoned.getMonth();
  const d = zoned.getDate();
  const minutes = zoned.getHours() * 60 + zoned.getMinutes();

  for (const hour of TOUCHPOINT_HOURS_IST) {
    if (minutes < hour * 60) {
      return istWallToUtcIso(y, m, d, hour);
    }
  }

  const tomorrow = new Date(y, m, d + 1);
  return istWallToUtcIso(
    tomorrow.getFullYear(),
    tomorrow.getMonth(),
    tomorrow.getDate(),
    TOUCHPOINT_HOURS_IST[0]
  );
}

export type ActionStatusInput = {
  deal_closed: boolean | null;
  is_dead: boolean;
  next_action_at: string | null;
  contact_attempts: number;
  call_confirmed: boolean | null;
  call_booked_at: string | null;
  last_action?: string | null;
};

/**
 * Precedence (highest wins):
 * Closed → Dead → Follow-up Overdue → Follow-up Due →
 * Personally Contacted → Qualified Call Booked → Call Booked → Untouched
 *
 * no_answer always schedules next_action_at, so those leads land in
 * Follow-up Due/Overdue — not a separate unanswered status. Last Action
 * still shows "Called — No Answer".
 */
export function computeActionStatus(
  lead: ActionStatusInput,
  _lastCallOutcome?: CallAttemptOutcome | null,
  _now: Date = new Date()
): ActionStatus {
  if (lead.deal_closed === true) return "Closed";
  if (lead.is_dead) return "Dead";

  if (lead.next_action_at) {
    const nextDay = toISTDateString(lead.next_action_at);
    const today = todayISTDateString();
    if (nextDay < today) return "Follow-up Overdue";
    if (nextDay === today) {
      // Due today even if the clock time is still ahead.
      return "Follow-up Due";
    }
    // Future next_action_at: fall through to contact/booking branches.
  }

  const attempts = lead.contact_attempts ?? 0;
  const noResolution =
    attempts > 0 && !lead.is_dead && lead.call_confirmed !== true;

  if (noResolution) {
    return "Personally Contacted";
  }

  if (lead.call_confirmed === true) return "Qualified Call Booked";
  if (lead.call_booked_at) return "Call Booked";
  return "Untouched";
}

export function isQuickformSource(leadSource: string | null | undefined): boolean {
  if (!leadSource) return false;
  return leadSource === "quickform" || leadSource.startsWith("quickform_");
}
