import { toISTDateString } from "@/lib/timezone";

/** A call is "booked on the call" if the lead's call_booked_at is within this of the row. */
export const BOOKED_ON_CALL_WINDOW_MS = 5 * 60 * 1000;

export type SetterCallActivity = {
  lead_id: string;
  outcome: string | null;
  created_at: string;
  created_by: string | null;
};

export type SetterActivityCounts = {
  dials: number;
  callsBooked: number;
  noAnswer: number;
  unqualified: number;
  followUp: number;
};

export type SetterActivityDay = SetterActivityCounts & { date: string };
export type SetterActivityUser = SetterActivityCounts & {
  userId: string | null;
  label: string;
};

export type SetterActivityReport = {
  daily: SetterActivityDay[];
  orgTotals: SetterActivityCounts;
  users: SetterActivityUser[];
  userTotals: SetterActivityCounts;
};

export function emptyCounts(): SetterActivityCounts {
  return { dials: 0, callsBooked: 0, noAnswer: 0, unqualified: 0, followUp: 0 };
}

function add(into: SetterActivityCounts, from: SetterActivityCounts) {
  into.dials += from.dials;
  into.callsBooked += from.callsBooked;
  into.noAnswer += from.noAnswer;
  into.unqualified += from.unqualified;
  into.followUp += from.followUp;
}

/**
 * Qualified rows that actually created the lead's booking: call_booked_at is
 * within BOOKED_ON_CALL_WINDOW_MS of the row. Excludes qualify calls on leads
 * already self-booked via cal.com, and leftover rows from failed saves (the
 * activity is inserted before the lead update). One row per lead — the closest.
 */
export function bookedOnCallRows(
  activities: SetterCallActivity[],
  callBookedAtByLead: Map<string, string | null>
): Set<SetterCallActivity> {
  const best = new Map<string, { row: SetterCallActivity; gap: number }>();
  for (const row of activities) {
    if (row.outcome !== "qualified") continue;
    const bookedAt = callBookedAtByLead.get(row.lead_id);
    if (!bookedAt) continue;
    const gap = Math.abs(new Date(bookedAt).getTime() - new Date(row.created_at).getTime());
    if (!(gap <= BOOKED_ON_CALL_WINDOW_MS)) continue;
    const prev = best.get(row.lead_id);
    if (!prev || gap < prev.gap) best.set(row.lead_id, { row, gap });
  }
  return new Set(Array.from(best.values(), (b) => b.row));
}

function countsFor(row: SetterCallActivity, booked: Set<SetterCallActivity>): SetterActivityCounts {
  const c = emptyCounts();
  c.dials = 1;
  if (booked.has(row)) c.callsBooked = 1;
  if (row.outcome === "no_answer") c.noAnswer = 1;
  if (row.outcome === "not_qualified") c.unqualified = 1;
  if (row.outcome === "follow_up_needed") c.followUp = 1;
  return c;
}

/**
 * Setter call activity for /insights. `activities` must already be
 * type = 'call_attempt' rows in the org + IST range; every row is a dial.
 */
export function computeSetterActivity(
  activities: SetterCallActivity[],
  callBookedAtByLead: Map<string, string | null>,
  userLabels: Map<string, string>
): SetterActivityReport {
  const booked = bookedOnCallRows(activities, callBookedAtByLead);
  const byDay = new Map<string, SetterActivityDay>();
  const byUser = new Map<string, SetterActivityUser>();
  const orgTotals = emptyCounts();

  for (const row of activities) {
    const c = countsFor(row, booked);
    add(orgTotals, c);

    const date = toISTDateString(row.created_at);
    const day = byDay.get(date) ?? { date, ...emptyCounts() };
    add(day, c);
    byDay.set(date, day);

    const key = row.created_by ?? "";
    const user =
      byUser.get(key) ??
      ({
        userId: row.created_by,
        label: row.created_by ? (userLabels.get(row.created_by) ?? row.created_by) : "Unknown",
        ...emptyCounts()
      } satisfies SetterActivityUser);
    add(user, c);
    byUser.set(key, user);
  }

  const users = Array.from(byUser.values()).sort(
    (a, b) => b.dials - a.dials || a.label.localeCompare(b.label)
  );
  const userTotals = emptyCounts();
  for (const u of users) add(userTotals, u);

  return {
    daily: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
    orgTotals,
    users,
    userTotals
  };
}
