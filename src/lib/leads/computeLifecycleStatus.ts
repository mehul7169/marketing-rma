export type LifecycleStatus = "active" | "unqualified" | "dead" | "closed";

export type LifecycleInput = {
  deal_closed: boolean | null;
  setter_verified: boolean | null;
  call_booked_at: string | null;
  post_call_status: string | null;
  qualified: boolean | null;
  requalification_attempted: boolean | null;
  requalification_result: string | null;
};

/**
 * Single source of truth for lead.lifecycle_status. Called on every write
 * alongside computeStage. Never set from the client.
 */
export function computeLifecycleStatus(input: LifecycleInput): LifecycleStatus {
  if (input.deal_closed === true) return "closed";
  if (input.setter_verified === false && input.call_booked_at) return "dead";
  if (input.post_call_status === "dead") return "dead";
  if (
    input.qualified === false &&
    !input.call_booked_at
  ) {
    return "unqualified";
  }
  return "active";
}
