import { countsAsCancelledBooking } from "@/lib/leads/cancelBooking";
import {
  CANCEL_BOOKING_LABELS,
  CANCEL_BOOKING_REASONS,
  type CancelBookingReason
} from "@/lib/leads/types";
import { toISTDateString } from "@/lib/timezone";

export type CancelledActivity = {
  type: string;
  outcome: string | null;
  created_at: string;
};

export type CancelledBookingsStat = {
  total: number;
  byReason: Partial<Record<CancelBookingReason, number>>;
};

export function emptyCancelledBookings(): CancelledBookingsStat {
  return { total: 0, byReason: {} };
}

export function summarizeCancelledBookings(
  activities: readonly CancelledActivity[],
  fromISO: string,
  toISO: string
): CancelledBookingsStat {
  const byReason: Partial<Record<CancelBookingReason, number>> = {};
  let total = 0;
  for (const a of activities) {
    if (a.type !== "call_cancelled") continue;
    const day = toISTDateString(a.created_at);
    if (day < fromISO || day > toISO) continue;
    const reason = a.outcome;
    if (!countsAsCancelledBooking(reason)) continue;
    total += 1;
    if (reason && (CANCEL_BOOKING_REASONS as readonly string[]).includes(reason)) {
      const key = reason as CancelBookingReason;
      byReason[key] = (byReason[key] ?? 0) + 1;
    }
  }
  return { total, byReason };
}

export function formatCancelledBreakdown(stat: CancelledBookingsStat): string {
  const parts = CANCEL_BOOKING_REASONS.filter((r) => (stat.byReason[r] ?? 0) > 0).map(
    (r) => `${CANCEL_BOOKING_LABELS[r]} ${stat.byReason[r]}`
  );
  return parts.join(" · ");
}
