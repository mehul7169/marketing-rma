import {
  planLifecycle,
  type LifecycleAction,
  type LifecyclePayload
} from "@/lib/leads/lifecycle";
import type { LeadRow } from "@/lib/leads/types";

/** Dummy payloads so the planner can report hard blocks without a real form. */
const PROBE: Record<LifecycleAction, LifecyclePayload> = {
  log_call_attempt: { outcome: "no_answer" },
  qualify: {},
  disqualify: {},
  clear_qualification: { reason: "probe" },
  book_call: { scheduledFor: "2099-01-01T00:00:00.000Z" },
  reschedule_call: { scheduledFor: "2099-01-01T00:00:00.000Z" },
  cancel_call: { reason: "probe" },
  mark_showed: {},
  mark_no_show: {},
  clear_show: { reason: "probe" },
  mark_dead: {},
  revive: {},
  set_follow_up: { followUpAt: "2099-01-01T00:00:00.000Z" }
};

export function lifecycleBlockReason(
  lead: LeadRow,
  action: LifecycleAction,
  payload?: LifecyclePayload
): string | null {
  const plan = planLifecycle(lead, action, payload ?? PROBE[action], {
    userId: null,
    email: null
  });
  return plan.ok ? null : plan.error;
}

export function bookedLeadDeadWarning(lead: LeadRow): string | null {
  if (lead.call_showed === true) {
    return "This lead showed up for a call. Mark it dead anyway?";
  }
  if (lead.call_booked_at) {
    return "This lead has a booked call. Mark it dead anyway?";
  }
  return null;
}
