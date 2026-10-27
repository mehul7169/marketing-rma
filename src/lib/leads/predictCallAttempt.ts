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
  return plan.ok ? plan.patch : null;
}
