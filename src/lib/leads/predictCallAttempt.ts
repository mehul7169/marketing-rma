import { computeActionStatus } from "@/lib/leads/actionStatus";
import { planLifecycle, type LogCallOutcome } from "@/lib/leads/lifecycle";
import type { LeadRow } from "@/lib/leads/types";

/**
 * Client-side prediction of log_call_attempt for optimistic UI. Uses the same
 * planner as the server, so it can't drift. Returns null when the server would reject.
 */
export function predictLogCallAttemptPatch(
  lead: LeadRow,
  outcome: LogCallOutcome,
  opts: {
    followUpAtIso?: string | null;
    scheduledForIso?: string | null;
  } = {}
): Partial<LeadRow> | null {
  const plan = planLifecycle(
    lead,
    "log_call_attempt",
    { outcome, followUpAt: opts.followUpAtIso, scheduledFor: opts.scheduledForIso },
    { userId: null, email: null }
  );
  if (!plan.ok) return null;
  const patch = plan.patch;
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
