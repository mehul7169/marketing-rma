/**
 * Allowlist of Work Queue / /leads custom-filter fields.
 * Types decide operators and value inputs. Unknown ids are rejected server-side.
 *
 * Null-safe "is not" / "does not contain" / "is none of": NULL (and empty
 * string, for text) counts as a match. "Source is not facebook" includes
 * leads with no source.
 */

import { LOST_REASON_LABELS, LOST_REASONS } from "@/lib/deals/dealLifecycle";
import { POST_CALL_STATUSES } from "@/lib/leads/computeStage";
import { humanizeFieldKey } from "@/lib/leads/customFields";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGES } from "@/lib/leads/lifecycleDefinitions";
import { DEAD_REASON_CODES, deadReasonLabel } from "@/lib/leads/types";

export const FILTER_FIELD_GROUPS = [
  "Lead info",
  "Pipeline",
  "Booking and show-up",
  "Post-call",
  "Attribution",
  "Form answers"
] as const;
export type FilterFieldGroup = (typeof FILTER_FIELD_GROUPS)[number];

export type FilterFieldType =
  | "text"
  | "number"
  | "datetime"
  | "boolean"
  | "tri"
  | "enum";

export const FILTER_OPS = [
  "contains",
  "not_contains",
  "is",
  "is_not",
  "is_empty",
  "is_not_empty",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "before",
  "after",
  "in_last",
  "in_next",
  "is_yes",
  "is_no",
  "is_blank",
  "is_any",
  "is_none"
] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export const OPS_BY_TYPE: Record<FilterFieldType, readonly FilterOp[]> = {
  text: ["contains", "not_contains", "is", "is_not", "is_empty", "is_not_empty"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_empty"],
  datetime: [
    "before",
    "after",
    "between",
    "in_last",
    "in_next",
    "is_empty",
    "is_not_empty"
  ],
  boolean: ["is_yes", "is_no"],
  tri: ["is_yes", "is_no", "is_blank"],
  enum: ["is_any", "is_none", "is_empty"]
};

export const FILTER_OP_LABELS: Record<FilterOp, string> = {
  contains: "contains",
  not_contains: "does not contain",
  is: "is",
  is_not: "is not",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  between: "between",
  before: "is before",
  after: "is after",
  in_last: "in the last N days",
  in_next: "in the next N days",
  is_yes: "is Yes",
  is_no: "is No",
  is_blank: "is blank",
  is_any: "is any of",
  is_none: "is none of"
};

export type FilterEnumOption = { value: string; label: string };

export type FilterFieldDef = {
  id: string;
  label: string;
  group: FilterFieldGroup;
  type: FilterFieldType;
  /** PostgREST column. Omitted for derived fields. */
  column?: string;
  derived?: "deal" | "traffic";
  /** Static enum options; live distinct values are merged at runtime. */
  enumValues?: FilterEnumOption[];
  enumSource?:
    | "lead_source"
    | "post_call_status"
    | "dead_reason"
    | "booking_source";
  /**
   * When a condition uses this field, Work Queue drops its implicit
   * hide-dead / hide-form-unqualified base filter.
   */
  yields?: "dead" | "form_qualified";
  /** "is not" / "does not contain" / "is none of" include NULL (and blank text). */
  nullSafeIsNot?: boolean;
};

const POST_CALL_LABELS: Record<string, string> = {
  follow_up_call_booked: "Follow-up Call Booked",
  awaiting_lead_response: "Awaiting Lead Response",
  proposal_needed: "Proposal Needed",
  contract_shared: "Contract Shared",
  awaiting_payment: "Awaiting Payment"
};

const FIXED_FIELDS: FilterFieldDef[] = [
  { id: "name", label: "Name", group: "Lead info", type: "text", column: "name", nullSafeIsNot: true },
  { id: "email", label: "Email", group: "Lead info", type: "text", column: "email", nullSafeIsNot: true },
  { id: "phone", label: "Phone", group: "Lead info", type: "text", column: "phone", nullSafeIsNot: true },
  { id: "notes", label: "Notes", group: "Lead info", type: "text", column: "notes", nullSafeIsNot: true },
  { id: "created_at", label: "Created", group: "Lead info", type: "datetime", column: "created_at" },
  {
    id: "last_action",
    label: "Last action",
    group: "Lead info",
    type: "text",
    column: "last_action",
    nullSafeIsNot: true
  },
  {
    id: "last_action_at",
    label: "Last action at",
    group: "Lead info",
    type: "datetime",
    column: "last_action_at"
  },
  {
    id: "contact_attempts",
    label: "Attempts",
    group: "Lead info",
    type: "number",
    column: "contact_attempts",
    nullSafeIsNot: true
  },

  {
    id: "pipeline_stage",
    label: "Stage",
    group: "Pipeline",
    type: "enum",
    column: "pipeline_stage",
    enumValues: PIPELINE_STAGES.map((s) => ({ value: s, label: PIPELINE_STAGE_LABELS[s] })),
    nullSafeIsNot: true
  },
  {
    id: "is_dead",
    label: "Dead",
    group: "Pipeline",
    type: "tri",
    column: "is_dead",
    yields: "dead"
  },
  {
    id: "dead_reason",
    label: "Dead reason",
    group: "Pipeline",
    type: "enum",
    column: "dead_reason",
    enumValues: DEAD_REASON_CODES.map((c) => ({ value: c, label: deadReasonLabel(c) ?? c })),
    enumSource: "dead_reason",
    yields: "dead",
    nullSafeIsNot: true
  },
  {
    id: "qualified",
    label: "Qualified",
    group: "Pipeline",
    type: "tri",
    column: "qualified"
  },
  {
    id: "qualified_at",
    label: "Qualified at",
    group: "Pipeline",
    type: "datetime",
    column: "qualified_at"
  },
  {
    id: "form_qualified",
    label: "Form Qualified",
    group: "Pipeline",
    type: "tri",
    column: "form_qualified",
    yields: "form_qualified"
  },
  {
    id: "first_contacted_at",
    label: "First contacted at",
    group: "Pipeline",
    type: "datetime",
    column: "first_contacted_at"
  },
  {
    id: "next_action_at",
    label: "Follow-up date",
    group: "Pipeline",
    type: "datetime",
    column: "next_action_at"
  },

  {
    id: "call_booked_at",
    label: "Call booked at",
    group: "Booking and show-up",
    type: "datetime",
    column: "call_booked_at"
  },
  {
    id: "call_scheduled_for",
    label: "Call scheduled for",
    group: "Booking and show-up",
    type: "datetime",
    column: "call_scheduled_for"
  },
  {
    id: "booking_source",
    label: "Booking source",
    group: "Booking and show-up",
    type: "enum",
    column: "booking_source",
    enumValues: [
      { value: "cal_com", label: "Cal.com" },
      { value: "manual", label: "Manual" }
    ],
    enumSource: "booking_source",
    nullSafeIsNot: true
  },
  {
    id: "call_showed",
    label: "Showed Up",
    group: "Booking and show-up",
    type: "tri",
    column: "call_showed"
  },
  {
    id: "call_showed_at",
    label: "Showed at",
    group: "Booking and show-up",
    type: "datetime",
    column: "call_showed_at"
  },
  {
    id: "reminder_sent",
    label: "Reminder sent",
    group: "Booking and show-up",
    type: "tri",
    column: "reminder_sent"
  },

  {
    id: "post_call_status",
    label: "Post-call status",
    group: "Post-call",
    type: "enum",
    column: "post_call_status",
    enumValues: POST_CALL_STATUSES.map((s) => ({
      value: s,
      label: POST_CALL_LABELS[s] ?? s
    })),
    enumSource: "post_call_status",
    nullSafeIsNot: true
  },
  {
    id: "deal",
    label: "Deal",
    group: "Post-call",
    type: "enum",
    derived: "deal",
    enumValues: [
      { value: "won", label: "Won" },
      { value: "lost", label: "Lost" },
      { value: "undecided", label: "Undecided" }
    ],
    yields: "dead",
    nullSafeIsNot: true
  },
  {
    id: "deal_value",
    label: "Deal value",
    group: "Post-call",
    type: "number",
    column: "deal_value",
    nullSafeIsNot: true
  },
  {
    id: "closed_at",
    label: "Closed at",
    group: "Post-call",
    type: "datetime",
    column: "closed_at"
  },
  {
    id: "recording_url",
    label: "Recording URL",
    group: "Post-call",
    type: "text",
    column: "recording_url",
    nullSafeIsNot: true
  },
  {
    id: "next_step",
    label: "Next step",
    group: "Post-call",
    type: "text",
    column: "next_step",
    nullSafeIsNot: true
  },
  {
    id: "lost_reason",
    label: "Lost reason",
    group: "Post-call",
    type: "enum",
    column: "lost_reason",
    enumValues: LOST_REASONS.map((r) => ({ value: r, label: LOST_REASON_LABELS[r] })),
    nullSafeIsNot: true
  },

  {
    id: "traffic",
    label: "Traffic",
    group: "Attribution",
    type: "enum",
    derived: "traffic",
    enumValues: [
      { value: "paid", label: "Paid" },
      { value: "organic", label: "Organic" }
    ]
  },
  {
    id: "lead_source",
    label: "Source",
    group: "Attribution",
    type: "enum",
    column: "lead_source",
    enumSource: "lead_source",
    nullSafeIsNot: true
  },
  {
    id: "utm_source",
    label: "UTM source",
    group: "Attribution",
    type: "text",
    column: "utm_source",
    nullSafeIsNot: true
  },
  {
    id: "utm_medium",
    label: "UTM medium",
    group: "Attribution",
    type: "text",
    column: "utm_medium",
    nullSafeIsNot: true
  },
  {
    id: "utm_campaign",
    label: "Campaign",
    group: "Attribution",
    type: "text",
    column: "utm_campaign",
    nullSafeIsNot: true
  },
  {
    id: "utm_content",
    label: "Ad name",
    group: "Attribution",
    type: "text",
    column: "utm_content",
    nullSafeIsNot: true
  },
  {
    id: "utm_term",
    label: "UTM term",
    group: "Attribution",
    type: "text",
    column: "utm_term",
    nullSafeIsNot: true
  },
  {
    id: "ad_set_id",
    label: "Ad set",
    group: "Attribution",
    type: "text",
    column: "ad_set_id",
    nullSafeIsNot: true
  }
];

const BY_ID = new Map(FIXED_FIELDS.map((f) => [f.id, f]));

export const CUSTOM_FIELD_PREFIX = "custom_fields.";

export function isSafeCustomFieldKey(key: string): boolean {
  return key.length > 0 && key.length <= 200 && !/[\\"\n\r]/.test(key);
}

/** PostgREST JSON text path; keys with punctuation are quoted. */
export function jsonTextColumn(key: string): string {
  return `custom_fields->>${JSON.stringify(key)}`;
}

export function customFilterFieldId(key: string): string {
  return `${CUSTOM_FIELD_PREFIX}${key}`;
}

export function listFixedFilterFields(): FilterFieldDef[] {
  return FIXED_FIELDS;
}

export function resolveFilterField(id: string): FilterFieldDef | null {
  const fixed = BY_ID.get(id);
  if (fixed) return fixed;
  if (!id.startsWith(CUSTOM_FIELD_PREFIX)) return null;
  const key = id.slice(CUSTOM_FIELD_PREFIX.length);
  if (!isSafeCustomFieldKey(key)) return null;
  return {
    id,
    label: humanizeFieldKey(key),
    group: "Form answers",
    type: "text",
    column: jsonTextColumn(key),
    nullSafeIsNot: true
  };
}

export function fieldsForPicker(customKeys: string[]): FilterFieldDef[] {
  const extra = customKeys
    .filter(isSafeCustomFieldKey)
    .map((key) => resolveFilterField(customFilterFieldId(key)))
    .filter((f): f is FilterFieldDef => Boolean(f));
  return [...FIXED_FIELDS, ...extra];
}

export function mergeEnumOptions(
  field: FilterFieldDef,
  live: string[] | undefined
): FilterEnumOption[] {
  const seen = new Set<string>();
  const out: FilterEnumOption[] = [];
  for (const opt of field.enumValues ?? []) {
    if (seen.has(opt.value)) continue;
    seen.add(opt.value);
    out.push(opt);
  }
  for (const raw of live ?? []) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: value });
  }
  return out;
}

export function opsForField(field: FilterFieldDef): readonly FilterOp[] {
  return OPS_BY_TYPE[field.type];
}
