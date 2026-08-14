export type LeadStage =
  | "closed"
  | "dead_post_call"
  | "dead_unqualified_at_booking"
  | "dead_unqualified"
  | "follow_up_call_booked"
  | "awaiting_lead_response"
  | "proposal_needed"
  | "contract_shared"
  | "awaiting_payment"
  | "showed"
  | "no_show"
  | "verified"
  | "booked"
  | "requalified"
  | "requalification_in_progress"
  | "form_qualified"
  | "form_unqualified"
  | "form_filled"
  | "lead";

export const POST_CALL_FOLLOW_UP_STAGES = [
  "follow_up_call_booked",
  "awaiting_lead_response",
  "proposal_needed",
  "contract_shared",
  "awaiting_payment"
] as const;

export type PostCallFollowUpStage = (typeof POST_CALL_FOLLOW_UP_STAGES)[number];

export type PostCallStatus = PostCallFollowUpStage | "dead";

export const POST_CALL_STATUSES: PostCallStatus[] = [
  ...POST_CALL_FOLLOW_UP_STAGES,
  "dead"
];

export const LEAD_STAGES: LeadStage[] = [
  "lead",
  "form_filled",
  "form_qualified",
  "form_unqualified",
  "requalification_in_progress",
  "requalified",
  "booked",
  "verified",
  "showed",
  "no_show",
  "follow_up_call_booked",
  "awaiting_lead_response",
  "proposal_needed",
  "contract_shared",
  "awaiting_payment",
  "dead_unqualified",
  "dead_unqualified_at_booking",
  "dead_post_call",
  "closed"
];

export const FUNNEL_STEPS: Array<{ stage: LeadStage; label: string }> = [
  { stage: "lead", label: "Lead" },
  { stage: "form_filled", label: "Form Filled" },
  { stage: "form_qualified", label: "Qualified" },
  { stage: "booked", label: "Booked" },
  { stage: "verified", label: "Verified" },
  { stage: "showed", label: "Showed" },
  { stage: "closed", label: "Closed" }
];

export type RequalificationResult = "requalified" | "still_unqualified";

export type StageInput = {
  deal_closed: boolean | null;
  post_call_status: string | null;
  setter_verified: boolean | null;
  call_booked_at: string | null;
  requalification_result: string | null;
  requalification_attempted: boolean | null;
  call_showed: boolean | null;
  qualified: boolean | null;
  form_filled_at: string | null;
};

function isFollowUpStatus(value: string | null): value is PostCallFollowUpStage {
  return (
    value !== null &&
    (POST_CALL_FOLLOW_UP_STAGES as readonly string[]).includes(value)
  );
}

/**
 * Single source of truth for lead.stage. Called on every write
 * (ingest routes and CRM actions). Never set stage from the client.
 * Most-advanced / terminal wins; first match returns.
 */
export function computeStage(input: StageInput): LeadStage {
  if (input.deal_closed === true) return "closed";
  if (input.post_call_status === "dead") return "dead_post_call";
  if (input.setter_verified === false && input.call_booked_at) {
    return "dead_unqualified_at_booking";
  }
  if (input.requalification_result === "still_unqualified") return "dead_unqualified";
  if (isFollowUpStatus(input.post_call_status)) return input.post_call_status;
  if (input.call_showed === true) return "showed";
  if (input.call_showed === false) return "no_show";
  if (input.setter_verified === true) return "verified";
  if (input.call_booked_at) return "booked";
  if (input.requalification_result === "requalified") return "requalified";
  if (input.requalification_attempted === true && !input.requalification_result) {
    return "requalification_in_progress";
  }
  if (input.qualified === true) return "form_qualified";
  if (input.qualified === false) return "form_unqualified";
  if (input.form_filled_at) return "form_filled";
  return "lead";
}
