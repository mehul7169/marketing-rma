import { needsQualification } from "@/lib/leads/lifecycleDefinitions";
import { BOOKED_ON_CALL_WINDOW_MS } from "@/lib/insights/setterActivity";
import {
  isCancelHistoryEntry,
  type BookingHistoryEntry,
  type CancelBookingReason,
  type LeadRow
} from "@/lib/leads/types";

export const CANCEL_BOOKING_UNDO_MS = 10 * 60 * 1000;
export const CANCEL_MISTAKE_WINDOW_MS = 30 * 60 * 1000;

export function canCancelBooking(
  lead: Pick<LeadRow, "call_booked_at" | "call_showed">
): boolean {
  return Boolean(lead.call_booked_at) && lead.call_showed !== true;
}

/** Work Queue "Qualified" = qualify + book in one step (timestamps within 5 min). */
export function isWorkQueueQualifyAndBook(
  lead: Pick<LeadRow, "qualified" | "qualified_at" | "call_booked_at" | "booking_source">
): boolean {
  if (lead.qualified !== true || !lead.qualified_at || !lead.call_booked_at) {
    return false;
  }
  const gap = Math.abs(
    new Date(lead.call_booked_at).getTime() - new Date(lead.qualified_at).getTime()
  );
  return gap <= BOOKED_ON_CALL_WINDOW_MS;
}

function bookingCreatedBy(
  lead: Pick<LeadRow, "qualified_by" | "booking_history" | "booking_source">,
  actorEmail: string | null | undefined
): boolean {
  const email = actorEmail?.trim();
  if (!email) return false;
  if (lead.qualified_by === email) return true;
  const hist = lead.booking_history ?? [];
  for (let i = hist.length - 1; i >= 0; i -= 1) {
    const e = hist[i];
    if (isCancelHistoryEntry(e)) continue;
    return e.changed_by === email;
  }
  return lead.booking_source === "manual";
}

export function defaultCancelReason(
  lead: Pick<
    LeadRow,
    | "call_booked_at"
    | "qualified"
    | "qualified_by"
    | "qualified_at"
    | "booking_history"
    | "booking_source"
  >,
  actorEmail: string | null | undefined,
  nowMs: number = Date.now()
): CancelBookingReason | null {
  if (lead.call_booked_at) {
    const bookedMs = new Date(lead.call_booked_at).getTime();
    if (
      Number.isFinite(bookedMs) &&
      nowMs - bookedMs <= CANCEL_MISTAKE_WINDOW_MS &&
      bookingCreatedBy(lead, actorEmail)
    ) {
      return "logged_by_mistake";
    }
  }
  if (needsQualification(lead)) return "not_qualified";
  return null;
}

export function latestCancelEntry(
  history: BookingHistoryEntry[] | null | undefined
): (BookingHistoryEntry & { cancelled_at: string }) | null {
  const hist = history ?? [];
  for (let i = hist.length - 1; i >= 0; i -= 1) {
    const e = hist[i];
    if (isCancelHistoryEntry(e)) return e;
  }
  return null;
}

export function countsAsCancelledBooking(reason: string | null | undefined): boolean {
  return Boolean(reason) && reason !== "logged_by_mistake";
}
