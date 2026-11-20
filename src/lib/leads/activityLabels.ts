const ACTIVITY_LABELS: Record<string, string> = {
  call_attempt: "Call",
  schedule: "Call booked",
  reschedule: "Rescheduled",
  call_cancelled: "Call cancelled",
  show_outcome: "Show",
  qualification: "Qualification",
  marked_dead: "Marked dead",
  revive: "Revived",
  field_edited: "Field edited",
  note: "Note",
  follow_up_set: "Follow-up set",
  deal_outcome: "Deal",
  deal_follow_up: "Follow-up",
  deal_next_step_set: "Next step",
  deal_stage_changed: "Stage",
  deal_owner_changed: "Owner",
  deal_reopened: "Reopened",
  lead_created: "Created"
};

export function activityTypeLabel(type: string): string {
  return ACTIVITY_LABELS[type] ?? type.replace(/_/g, " ");
}
