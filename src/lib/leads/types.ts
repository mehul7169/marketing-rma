import type { FollowUpState, KpiKey } from "@/lib/leads/lifecycleDefinitions";

export type BookingSource = "cal_com" | "manual";

export type BookingHistoryEntry = {
  changed_at: string;
  previous_scheduled_for: string | null;
  new_scheduled_for: string;
  source: BookingSource;
  changed_by: string;
};

export type LeadReminder = {
  id: string;
  org_id: string;
  lead_id: string;
  text: string;
  due_at: string | null;
  created_at: string;
  created_by: string | null;
  resolved: boolean;
  resolved_at: string | null;
};

export type PipelineStage = "new" | "contacted" | "qualified" | "call_booked" | "showed_up";

export type DeadFilter = "hide" | "show" | "only";
export type YesNoFilter = "yes" | "no";

/** dead_reason codes written by the app. Older rows keep free-text reasons. */
export const DEAD_REASON_CODES = [
  "not_qualified",
  "no_show",
  "no_answer",
  "not_interested",
  "other"
] as const;
export type DeadReasonCode = (typeof DEAD_REASON_CODES)[number];

const DEAD_REASON_LABELS: Record<string, string> = {
  not_qualified: "Not qualified",
  no_show: "No-show",
  no_answer: "No answer after 3 attempts",
  not_interested: "Not interested",
  other: "Other",
  "no answer after 3 touchpoints": "No answer after 3 attempts",
  "reached lead, confirmed not qualified": "Not qualified",
  "booked but not confirmed qualified": "Booked but not confirmed qualified"
};

export function deadReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return DEAD_REASON_LABELS[reason] ?? reason;
}

export type VerificationCallStatus =
  | "not_contacted"
  | "no_answer"
  | "follow_up_needed"
  | "reached";

export type LeadRow = {
  id: string;
  org_id: string;
  email: string;
  ghl_contact_id: string | null;
  name: string | null;
  phone: string | null;
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ad_set_id: string | null;
  lead_source: string | null;
  form_filled_at: string | null;
  /** Arbitrary per-source form answers (JSONB merge on ingest). */
  custom_fields: Record<string, unknown>;
  /** The website form's own verdict (tag only). Never the setter's decision. */
  form_qualified: boolean | null;
  /** Contacted milestone: first call attempt. Set once, never cleared. */
  first_contacted_at: string | null;
  /** Postgres-generated pre-call stage. Read-only: never include it in a write. */
  pipeline_stage?: PipelineStage | null;
  /** Setter decision. */
  qualified: boolean | null;
  qualified_at: string | null;
  qualified_by: string | null;
  call_booked_at: string | null;
  call_scheduled_for: string | null;
  cal_com_booking_id: string | null;
  booking_source: BookingSource | null;
  booking_history: BookingHistoryEntry[];
  verification_call_status: VerificationCallStatus;
  verification_call_attempts: number;
  last_verification_call_at: string | null;
  reminder_sent: boolean | null;
  reminder_sent_at: string | null;
  call_showed: boolean | null;
  call_showed_at: string | null;
  call_showed_by: string | null;
  deal_closed: boolean | null;
  deal_value: number | null;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  recording_url: string | null;
  stage: string | null;
  requalification_attempted: boolean | null;
  requalification_called_at: string | null;
  requalification_result: string | null;
  requalification_notes: string | null;
  post_call_status: string | null;
  post_call_status_updated_at: string | null;
  post_call_status_updated_by: string | null;
  is_dead: boolean;
  dead_reason: string | null;
  contact_attempts: number;
  next_action_at: string | null;
  last_action: string | null;
  last_action_at: string | null;
  updated_at: string;
  slack_form_notified: boolean;
  slack_booking_notified: boolean;
  slack_no_booking_notified: boolean;
};

export type LeadListFilters = {
  /** Required for all UI list queries — never omit. */
  orgId: string;
  /** IST days, inclusive. Applied to the KPI's milestone field, else created_at. */
  fromISO?: string;
  toISO?: string;
  /** Milestone deep link (lifecycleDefinitions KPI_DEFINITIONS). */
  kpi?: KpiKey;
  pipelineStages?: PipelineStage[];
  /** Default (omitted) = show. */
  dead?: DeadFilter;
  formQualified?: YesNoFilter;
  qualified?: YesNoFilter;
  needsQualification?: boolean;
  /** next_action_at bucket(s) by IST day; any of the listed states matches. */
  followUp?: FollowUpState[];
  /** Hide form_qualified=false with no setter decision. */
  hideFormUnqualified?: boolean;
  sources?: string[];
  search?: string;
  /** call_scheduled_for set and still in the future. */
  meetingsBookedOnly?: boolean;
  /**
   * newest = created_at desc (Work Queue default).
   * oldest = created_at asc.
   * follow_up / queue = next_action_at asc (nulls last), then created_at desc.
   * date / omitted = dateField desc (`/leads` KPI lists).
   */
  sort?: "date" | "queue" | "newest" | "oldest" | "follow_up";
  /** Page size (e.g. 50). Omit for unbounded (admin/scripts). */
  limit?: number;
  /** 0-based offset into the ordered result set. */
  offset?: number;
};
