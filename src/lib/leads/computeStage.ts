export type LeadStage =
  | "created"
  | "call_booked"
  | "qualified_call_booked"
  | "show_up"
  | "follow_up_call_booked"
  | "awaiting_lead_response"
  | "proposal_needed"
  | "contract_shared"
  | "awaiting_payment"
  | "dead"
  | "closed";

export const POST_CALL_FOLLOW_UP_STAGES = [
  "follow_up_call_booked",
  "awaiting_lead_response",
  "proposal_needed",
  "contract_shared",
  "awaiting_payment"
] as const;

export type PostCallFollowUpStage = (typeof POST_CALL_FOLLOW_UP_STAGES)[number];

/** Post-call follow-up statuses only — terminal dead uses is_dead, not this field. */
export type PostCallStatus = PostCallFollowUpStage;

export const POST_CALL_STATUSES: PostCallStatus[] = [...POST_CALL_FOLLOW_UP_STAGES];

/** Filter / badge order for /leads Stage dropdown. */
export const LEAD_STAGES: LeadStage[] = [
  "created",
  "call_booked",
  "qualified_call_booked",
  "show_up",
  "follow_up_call_booked",
  "awaiting_lead_response",
  "proposal_needed",
  "contract_shared",
  "awaiting_payment",
  "dead",
  "closed"
];

/** Overview funnel steps (subset of LeadStage). */
export const FUNNEL_STEPS: Array<{ stage: LeadStage; label: string }> = [
  { stage: "created", label: "Created" },
  { stage: "call_booked", label: "Call Booked" },
  { stage: "qualified_call_booked", label: "Qualified Call Booked" },
  { stage: "show_up", label: "Show Up" },
  { stage: "closed", label: "Closed" }
];

export type RequalificationResult = "requalified" | "still_unqualified";

export type StageInput = {
  deal_closed: boolean | null;
  is_dead: boolean;
  post_call_status: string | null;
  call_showed: boolean | null;
  call_confirmed: boolean | null;
  call_booked_at: string | null;
};

function isFollowUpStatus(value: string | null): value is PostCallFollowUpStage {
  return (
    value !== null &&
    (POST_CALL_FOLLOW_UP_STAGES as readonly string[]).includes(value)
  );
}

/**
 * call_confirmed is a persistent flag (never reset once true). Set by Work Queue
 * "Qualified" call outcome, or by Setter verified = Yes on a booked lead.
 */
export function resolveCallConfirmed(input: {
  call_confirmed: boolean | null;
  setter_verified: boolean | null;
  call_booked_at: string | null;
}): boolean | null {
  if (input.call_confirmed === true) return true;
  if (input.setter_verified === true && input.call_booked_at) return true;
  return input.call_confirmed;
}

/**
 * Single source of truth for lead.stage. Called on every write.
 * Precedence (highest wins):
 * closed → dead → post-call follow-up → show_up →
 * qualified_call_booked → call_booked → created
 */
export function computeStage(input: StageInput): LeadStage {
  if (input.deal_closed === true) return "closed";
  if (input.is_dead) return "dead";
  if (isFollowUpStatus(input.post_call_status)) return input.post_call_status;
  if (input.call_showed === true) return "show_up";
  if (input.call_confirmed === true && input.call_booked_at) {
    return "qualified_call_booked";
  }
  if (input.call_booked_at) return "call_booked";
  return "created";
}
