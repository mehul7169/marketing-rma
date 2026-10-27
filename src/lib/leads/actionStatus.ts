import {
  IST_TIMEZONE,
  utcToZonedTime,
  zonedTimeToUtc,
} from "@/lib/timezone";

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
  | "reschedule"
  | "revive"
  | "note"
  | "show_outcome"
  | "qualification"
  | "setter_verification"
  | "deal_outcome"
  | "schedule"
  | "lead_created"
  | "field_edited"
  | "call_cancelled"
  | "marked_dead"
  | "follow_up_set";

/** Default calling windows (IST): Morning / Afternoon / Evening. */
export const TOUCHPOINT_HOURS_IST = [10, 13, 16] as const;

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
  hour: number,
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
    TOUCHPOINT_HOURS_IST[0],
  );
}

export function isQuickformSource(
  leadSource: string | null | undefined,
): boolean {
  if (!leadSource) return false;
  return leadSource === "quickform" || leadSource.startsWith("quickform_");
}
