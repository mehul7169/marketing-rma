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
  lead_id: string;
  text: string;
  due_at: string | null;
  created_at: string;
  created_by: string | null;
  resolved: boolean;
  resolved_at: string | null;
};

export type LeadRow = {
  id: string;
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
  describes_you: string | null;
  biggest_goal: string | null;
  monthly_revenue: string | null;
  investment_capacity: string | null;
  form_filled_at: string | null;
  form_answers: Record<string, unknown> | null;
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
  stage: string | null;
  requalification_attempted: boolean | null;
  requalification_called_at: string | null;
  requalification_result: string | null;
  requalification_notes: string | null;
  post_call_status: string | null;
  post_call_status_updated_at: string | null;
  post_call_status_updated_by: string | null;
  lifecycle_status: string | null;
  updated_at: string;
};

export type LeadListFilters = {
  fromISO?: string;
  toISO?: string;
  stages?: string[];
  sources?: string[];
  search?: string;
  lifecycle?: string;
  needsRequal?: boolean;
  followUpsDue?: boolean;
};
