import type { LeadStage } from "@/lib/leads/computeStage";

const MUTED = "bg-slate-100 text-slate-500";
const FOLLOW_UP = "bg-amber-50 text-amber-900";
const ACTIVE = "bg-blue-50 text-blue-800";
const CLOSED = "bg-emerald-50 text-emerald-800";
const NEUTRAL = "bg-slate-100 text-slate-700";

const STYLES: Record<string, string> = {
  lead: NEUTRAL,
  form_filled: NEUTRAL,
  form_qualified: ACTIVE,
  form_unqualified: MUTED,
  requalification_in_progress: ACTIVE,
  requalified: ACTIVE,
  booked: ACTIVE,
  verified: ACTIVE,
  showed: ACTIVE,
  no_show: MUTED,
  follow_up_call_booked: FOLLOW_UP,
  awaiting_lead_response: FOLLOW_UP,
  proposal_needed: FOLLOW_UP,
  contract_shared: FOLLOW_UP,
  awaiting_payment: FOLLOW_UP,
  dead_unqualified: MUTED,
  dead_unqualified_at_booking: MUTED,
  dead_post_call: MUTED,
  closed: CLOSED,
  qualified: ACTIVE,
  disqualified: MUTED,
  lost: MUTED
};

const LABELS: Record<string, string> = {
  lead: "Lead",
  form_filled: "Form filled",
  form_qualified: "Form qualified",
  form_unqualified: "Form unqualified",
  requalification_in_progress: "Requalification in progress",
  requalified: "Requalified",
  booked: "Booked",
  verified: "Verified",
  showed: "Showed",
  no_show: "No-show",
  follow_up_call_booked: "Follow-up call booked",
  awaiting_lead_response: "Awaiting lead response",
  proposal_needed: "Proposal needed",
  contract_shared: "Contract shared",
  awaiting_payment: "Awaiting payment",
  dead_unqualified: "Unqualified",
  dead_unqualified_at_booking: "Unqualified (at booking)",
  dead_post_call: "Dead (post-call)",
  closed: "Closed",
  qualified: "Form qualified",
  disqualified: "Form unqualified",
  lost: "Lost"
};

export function stageLabel(stage: string | null): string {
  if (!stage) return "Lead";
  return LABELS[stage] ?? stage;
}

export default function StageBadge({ stage }: { stage: string | null }) {
  const key = (stage ?? "lead") as LeadStage;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[key] ?? STYLES.lead}`}
    >
      {stageLabel(stage)}
    </span>
  );
}
