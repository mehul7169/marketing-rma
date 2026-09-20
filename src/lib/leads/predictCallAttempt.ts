import {
  callAttemptSummary,
  computeActionStatus,
  nextTouchpointAt,
  type CallAttemptOutcome
} from "@/lib/leads/actionStatus";
import type { LeadRow } from "@/lib/leads/types";

/**
 * Client-side prediction of logCallAttempt field changes for optimistic UI.
 * Must stay aligned with src/lib/leads/lifecycleCadence.ts logCallAttempt.
 */
export function predictLogCallAttemptPatch(
  lead: LeadRow,
  outcome: CallAttemptOutcome,
  opts: {
    followUpAtIso?: string | null;
    scheduledForIso?: string | null;
  } = {}
): Partial<LeadRow> {
  const now = new Date().toISOString();
  const patch: Partial<LeadRow> = {
    last_action: callAttemptSummary(outcome),
    last_action_at: now,
    contact_attempts: (lead.contact_attempts ?? 0) + 1
  };

  if (outcome === "no_answer") {
    const attempts = (lead.contact_attempts ?? 0) + 1;
    patch.contact_attempts = attempts;
    if (attempts >= 3) {
      patch.is_dead = true;
      patch.dead_reason = "no answer after 3 touchpoints";
      patch.next_action_at = null;
    } else {
      patch.next_action_at = nextTouchpointAt(new Date());
      patch.is_dead = false;
    }
  } else if (outcome === "follow_up_needed") {
    patch.next_action_at = opts.followUpAtIso ?? lead.next_action_at;
  } else if (outcome === "qualified") {
    patch.qualified = true;
    patch.call_booked_at = lead.call_booked_at ?? now;
    patch.call_scheduled_for =
      opts.scheduledForIso ?? lead.call_scheduled_for;
    patch.call_confirmed = true;
    patch.contact_attempts = 0;
    patch.next_action_at = null;
  } else if (outcome === "not_qualified") {
    patch.qualified = false;
    patch.is_dead = true;
    patch.dead_reason = "reached lead, confirmed not qualified";
    patch.next_action_at = null;
  } else if (outcome === "confirmed") {
    patch.call_confirmed = true;
    patch.contact_attempts = 0;
    patch.next_action_at = null;
  } else if (outcome === "not_confirmed") {
    patch.is_dead = true;
    patch.dead_reason = "booked but not confirmed qualified";
    patch.next_action_at = null;
  }

  const merged = { ...lead, ...patch };
  patch.action_status = computeActionStatus(
    {
      deal_closed: merged.deal_closed,
      is_dead: Boolean(merged.is_dead),
      next_action_at: merged.next_action_at,
      contact_attempts: merged.contact_attempts ?? 0,
      call_confirmed: merged.call_confirmed,
      call_booked_at: merged.call_booked_at,
      last_action: merged.last_action
    },
    outcome
  );

  return patch;
}
