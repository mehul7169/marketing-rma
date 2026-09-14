export type LifecycleStatus = "active" | "unqualified" | "dead" | "closed";

export type LifecycleInput = {
  deal_closed: boolean | null;
  is_dead: boolean;
  call_booked_at: string | null;
  qualified: boolean | null;
};

/**
 * Single source of truth for lead.lifecycle_status. Called on every write
 * alongside computeStage. Never set from the client.
 *
 * Dead is driven by is_dead only (reason lives in dead_reason). Legacy
 * post_call_status="dead" / setter_verified=false are not used here.
 */
export function computeLifecycleStatus(input: LifecycleInput): LifecycleStatus {
  if (input.deal_closed === true) return "closed";
  if (input.is_dead) return "dead";
  if (input.qualified === false && !input.call_booked_at) {
    return "unqualified";
  }
  return "active";
}
