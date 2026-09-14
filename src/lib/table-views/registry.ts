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
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "action_status", label: "Action Status" },
  { id: "last_action", label: "Last Action" },
  { id: "next_action", label: "Next Action" },
  { id: "contact_attempts", label: "Attempts" },
  { id: "lead_source", label: "Source" },
  { id: "stage", label: "Stage" },
  { id: "created_at", label: "Created" },
  { id: "call_scheduled_for", label: "Call scheduled" },
  { id: "call_booked_at", label: "Call booked" },
  { id: "call_confirmed", label: "Call confirmed" },
  { id: "qualified", label: "Qualified" },
  { id: "is_dead", label: "Dead" },
  { id: "notes", label: "Notes" },
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

function col(
  id: string,
  visible = true
): TableColumnConfig {
  return { id, visible, width: null };
}

/** Hardcoded defaults matching each page before this feature. */
export const DEFAULT_COLUMNS: Record<TableViewPageKey, TableColumnConfig[]> = {
  leads: [
    col("name"),
    col("email"),
    col("phone"),
    col("lead_source"),
    col("action_status"),
    col("last_action"),
    col("next_action"),
    col("contact_attempts"),
    col("stage"),
    col("created_at"),
    col("call_scheduled_for"),
    col("actions")
  ],
  "leads-queue": [
    col("name"),
    col("action_status"),
    col("last_action"),
    col("next_action"),
    col("contact_attempts"),
    col("actions")
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
