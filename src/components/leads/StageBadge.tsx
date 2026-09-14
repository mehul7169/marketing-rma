import type { LeadStage } from "@/lib/leads/computeStage";

const MUTED = "bg-slate-100 text-slate-500";
const FOLLOW_UP = "bg-amber-50 text-amber-900";
const ACTIVE = "bg-blue-50 text-blue-800";
const CLOSED = "bg-emerald-50 text-emerald-800";
const NEUTRAL = "bg-slate-100 text-slate-700";

const STYLES: Record<LeadStage, string> = {
  created: NEUTRAL,
  call_booked: ACTIVE,
  qualified_call_booked: ACTIVE,
  show_up: ACTIVE,
  follow_up_call_booked: FOLLOW_UP,
  awaiting_lead_response: FOLLOW_UP,
  proposal_needed: FOLLOW_UP,
  contract_shared: FOLLOW_UP,
  awaiting_payment: FOLLOW_UP,
  dead: MUTED,
  closed: CLOSED
};

const LABELS: Record<LeadStage, string> = {
  created: "Created",
  call_booked: "Call Booked",
  qualified_call_booked: "Qualified Call Booked",
  show_up: "Show Up",
  follow_up_call_booked: "Follow-up Call Booked",
  awaiting_lead_response: "Awaiting Lead Response",
  proposal_needed: "Proposal Needed",
  contract_shared: "Contract Shared",
  awaiting_payment: "Awaiting Payment",
  dead: "Dead",
  closed: "Closed"
};

export function stageLabel(stage: string | null): string {
  if (!stage) return LABELS.created;
  if (stage in LABELS) return LABELS[stage as LeadStage];
  return stage;
}

export default function StageBadge({ stage }: { stage: string | null }) {
  const key = (stage && stage in STYLES ? stage : "created") as LeadStage;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[key]}`}
    >
      {stageLabel(stage)}
    </span>
  );
}
