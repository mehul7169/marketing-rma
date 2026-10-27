import type { TableColumnConfig } from "@/lib/table-views/types";

/** Known page keys — extend when wiring /meta-ads, /insights, etc. */
export const TABLE_VIEW_PAGE_KEYS = ["leads", "leads-queue"] as const;
export type TableViewPageKey = (typeof TABLE_VIEW_PAGE_KEYS)[number];

export function isTableViewPageKey(value: string): value is TableViewPageKey {
  return (TABLE_VIEW_PAGE_KEYS as readonly string[]).includes(value);
}

export type FixedColumnDef = {
  id: string;
  label: string;
  /** Only listed for platform admins in available-columns. */
  platformAdminOnly?: boolean;
};

/** Pages whose available columns include org custom_fields.* keys. */
export const LEADS_BACKED_PAGE_KEYS: ReadonlySet<string> = new Set([
  "leads",
  "leads-queue"
]);

const LEADS_FIXED: FixedColumnDef[] = [
  { id: "name", label: "Name" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "stage", label: "Stage" },
  { id: "is_dead", label: "Dead" },
  { id: "qualified", label: "Qualified" },
  { id: "form_qualified", label: "Form Qualified" },
  { id: "call_booked_at", label: "Call Booked" },
  { id: "call_scheduled_for", label: "Call Scheduled For" },
  { id: "call_showed", label: "Showed Up" },
  { id: "next_action", label: "Follow-up date" },
  { id: "last_action", label: "Last action" },
  { id: "qualified_by", label: "Setter" },
  { id: "lead_source", label: "Source" },
  { id: "created_at", label: "Created at" },
  { id: "notes", label: "Notes" },
  { id: "contact_attempts", label: "Attempts" },
  { id: "deal_value", label: "Deal value" },
  { id: "recording_url", label: "Recording" },
  { id: "actions", label: "Actions" },
  { id: "org_name", label: "Org", platformAdminOnly: true }
];

const FIXED_BY_PAGE: Record<TableViewPageKey, FixedColumnDef[]> = {
  leads: LEADS_FIXED,
  "leads-queue": LEADS_FIXED
};

export function fixedColumnsForPage(
  pageKey: string,
  opts?: { isPlatformAdmin?: boolean }
): FixedColumnDef[] {
  if (!isTableViewPageKey(pageKey)) return [];
  const cols = FIXED_BY_PAGE[pageKey];
  if (opts?.isPlatformAdmin) return cols;
  return cols.filter((c) => !c.platformAdminOnly);
}

/** Optional default pixel widths — content-sized, not equal stretch. */
export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  name: 160,
  email: 200,
  phone: 120,
  last_action: 140,
  next_action: 140,
  contact_attempts: 72,
  lead_source: 110,
  stage: 220,
  created_at: 130,
  call_scheduled_for: 160,
  call_booked_at: 130,
  call_showed: 100,
  form_qualified: 110,
  qualified: 110,
  qualified_by: 140,
  is_dead: 140,
  notes: 180,
  deal_value: 100,
  recording_url: 100,
  actions: 220,
  org_name: 120
};

function col(id: string, visible = true): TableColumnConfig {
  return {
    id,
    visible,
    width: DEFAULT_COLUMN_WIDTHS[id] ?? 120
  };
}

/** Hardcoded defaults matching each page before this feature. */
const LEADS_DEFAULT_VISIBLE = [
  "name",
  "phone",
  "stage",
  "is_dead",
  "qualified",
  "form_qualified",
  "call_booked_at",
  "call_scheduled_for",
  "call_showed",
  "next_action",
  "last_action",
  "qualified_by",
  "lead_source",
  "created_at",
  "notes"
] as const;

export const DEFAULT_COLUMNS: Record<TableViewPageKey, TableColumnConfig[]> = {
  leads: LEADS_DEFAULT_VISIBLE.map((id) => col(id)),
  "leads-queue": [
    col("name"),
    col("phone"),
    col("stage"),
    col("is_dead"),
    col("qualified"),
    col("call_scheduled_for"),
    col("call_showed"),
    col("next_action"),
    col("last_action"),
    col("notes")
  ]
};

export function defaultColumnsForPage(pageKey: string): TableColumnConfig[] {
  if (!isTableViewPageKey(pageKey)) return [];
  return DEFAULT_COLUMNS[pageKey].map((c) => ({ ...c }));
}

export function labelForFixedColumn(
  pageKey: string,
  id: string
): string | null {
  if (!isTableViewPageKey(pageKey)) return null;
  return FIXED_BY_PAGE[pageKey].find((c) => c.id === id)?.label ?? null;
}
