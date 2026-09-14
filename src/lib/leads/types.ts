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
  qualified: boolean | null;
  qualified_at: string | null;
  qualified_by: string | null;
  call_booked_at: string | null;
  call_scheduled_for: string | null;
  cal_com_booking_id: string | null;
  booking_source: BookingSource | null;
  booking_history: BookingHistoryEntry[];
  call_cancelled_at: string | null;
  setter_verified: boolean | null;
  setter_verified_at: string | null;
  setter_verified_by: string | null;
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
  lifecycle_status: string | null;
  /** CRM work-queue status; null = Untouched (pre-backfill rows). */
  action_status: string | null;
  is_dead: boolean;
  dead_reason: string | null;
  contact_attempts: number;
  call_confirmed: boolean | null;
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
  fromISO?: string;
  toISO?: string;
  stages?: string[];
  /** Legacy event-in-range deep link (timestamp of the event in range). */
  event?: string;
  /** Cohort deep link: created_at in range + ever reached this stage. */
  cohort?: string;
  sources?: string[];
  search?: string;
  lifecycle?: string;
  needsRequal?: boolean;
  /** Booked, setter_verified unset, verification not yet reached. */
  needsVerificationCall?: boolean;
  followUpsDue?: boolean;
  /** Match action_status; include null rows when filtering Untouched. */
  actionStatuses?: string[];
  /** true / false / omit (no filter). */
  isDead?: boolean;
  /** Work Queue: hide dead + closed by default. */
  excludeDeadAndClosed?: boolean;
  /** next_action_at after end of today (IST). */
  upcomingOnly?: boolean;
};
