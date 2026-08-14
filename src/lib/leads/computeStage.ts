export type LeadStage =
  | "closed"
  | "lost"
  | "no_show"
  | "showed"
  | "verified"
  | "booked"
  | "qualified"
  | "disqualified"
  | "form_filled"
  | "lead";

export const LEAD_STAGES: LeadStage[] = [
  "lead",
  "form_filled",
  "qualified",
  "disqualified",
  "booked",
  "verified",
  "showed",
  "no_show",
  "closed",
  "lost"
];

export const FUNNEL_STEPS: Array<{ stage: LeadStage; label: string }> = [
  { stage: "lead", label: "Lead" },
  { stage: "form_filled", label: "Form Filled" },
  { stage: "qualified", label: "Qualified" },
  { stage: "booked", label: "Booked" },
  { stage: "verified", label: "Verified" },
  { stage: "showed", label: "Showed" },
  { stage: "closed", label: "Closed" }
];

export type StageInput = {
  deal_closed: boolean | null;
  call_showed: boolean | null;
  setter_verified: boolean | null;
  call_booked_at: string | null;
  call_cancelled_at: string | null;
  qualified: boolean | null;
  form_filled_at: string | null;
};

function isActivelyBooked(input: StageInput): boolean {
  if (!input.call_booked_at) return false;
  if (!input.call_cancelled_at) return true;
  return input.call_booked_at > input.call_cancelled_at;
}

/**
 * Single source of truth for lead.stage. Called on every write
 * (ingest routes and CRM actions). Never set stage from the client.
 */
export function computeStage(input: StageInput): LeadStage {
  if (input.deal_closed === true) return "closed";
  if (input.deal_closed === false) return "lost";
  if (input.call_showed === false) return "no_show";
  if (input.call_showed === true) return "showed";
  if (input.setter_verified === true) return "verified";
  if (isActivelyBooked(input)) return "booked";
  if (input.qualified === true) return "qualified";
  if (input.qualified === false) return "disqualified";
  if (input.form_filled_at) return "form_filled";
  return "lead";
}
