import type { PostCallStatus } from "@/lib/leads/computeStage";
import {
  FOLLOW_UP_STYLES,
  followUpState,
  needsQualification,
  pipelineStageLabel,
  pipelineStageOf
} from "@/lib/leads/lifecycleDefinitions";
import { deadReasonLabel, type LeadRow, type PipelineStage } from "@/lib/leads/types";
import { formatDueFriendly } from "@/lib/timezone";

const PILL = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

const STAGE_STYLES: Record<PipelineStage, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-sky-50 text-sky-900",
  qualified: "bg-indigo-50 text-indigo-800",
  call_booked: "bg-blue-50 text-blue-800",
  showed_up: "bg-emerald-50 text-emerald-800"
};

const POST_CALL_LABELS: Record<PostCallStatus, string> = {
  follow_up_call_booked: "Follow-up Call Booked",
  awaiting_lead_response: "Awaiting Lead Response",
  proposal_needed: "Proposal Needed",
  contract_shared: "Contract Shared",
  awaiting_payment: "Awaiting Payment"
};

export function postCallStatusLabel(status: string | null): string {
  if (!status) return "—";
  return POST_CALL_LABELS[status as PostCallStatus] ?? status;
}

type BadgeLead = Pick<
  LeadRow,
  | "call_showed"
  | "call_booked_at"
  | "qualified"
  | "first_contacted_at"
  | "is_dead"
  | "dead_reason"
  | "form_qualified"
  | "next_action_at"
>;

export default function StageBadge({ lead }: { lead: BadgeLead }) {
  // Derived, not lead.pipeline_stage: optimistic rows don't carry the generated column.
  const stage = pipelineStageOf(lead);
  return <span className={`${PILL} ${STAGE_STYLES[stage]}`}>{pipelineStageLabel(stage)}</span>;
}

/** Coloured next-action date (grey future, amber today, red past). Never stored. */
export function FollowUpDate({
  at,
  todayISO,
  pill = false
}: {
  at: string | null | undefined;
  todayISO?: string;
  pill?: boolean;
}) {
  if (!at) return <span>—</span>;
  const state = followUpState(at, todayISO);
  const text = formatDueFriendly(at);
  if (!state) return <span>{text}</span>;
  return (
    <span className={pill ? `${PILL} ${FOLLOW_UP_STYLES[state]}` : FOLLOW_UP_STYLES[state]}>
      {text}
    </span>
  );
}

/** Stage + Dead tag + overlay badges (Needs qualification, Form Qualified, Follow-up). */
export function LeadStatusBadges({
  lead,
  todayISO,
  showFollowUp = true
}: {
  lead: BadgeLead;
  todayISO?: string;
  showFollowUp?: boolean;
}) {
  const followUp = showFollowUp ? followUpState(lead.next_action_at, todayISO) : null;
  const reason = lead.is_dead ? deadReasonLabel(lead.dead_reason) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <StageBadge lead={lead} />
      {lead.is_dead ? (
        <span className={`${PILL} bg-slate-200 text-slate-600`} title={reason ?? undefined}>
          Dead{reason ? ` · ${reason}` : ""}
        </span>
      ) : null}
      {needsQualification(lead) ? (
        <span className={`${PILL} bg-amber-50 text-amber-900`}>Needs qualification</span>
      ) : null}
      {lead.form_qualified !== null ? (
        <span
          className={`${PILL} ${
            lead.form_qualified ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-500"
          }`}
        >
          Form Qualified: {lead.form_qualified ? "Yes" : "No"}
        </span>
      ) : null}
      {followUp ? <FollowUpDate at={lead.next_action_at} todayISO={todayISO} pill /> : null}
    </span>
  );
}
