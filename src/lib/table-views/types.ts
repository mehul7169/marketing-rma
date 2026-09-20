/** Shared table-view config — per-user, per page_key. */

export type TableColumnConfig = {
  /** Stable id, e.g. "email" or "custom_fields.describes_you" */
  id: string;
  visible: boolean;
  /** Pixel width; null falls back to DEFAULT_COLUMN_WIDTHS / auto. */
  width?: number | null;
};

export type TableViewConfig = {
  columns: TableColumnConfig[];
};

export type AvailableColumn = {
  id: string;
  label: string;
  /** fixed = lead/page field; custom_field = from custom_fields JSONB */
  source: "fixed" | "custom_field";
};

/** Server-loaded payload for hydrating useTableView without a client flash. */
export type TableViewBootstrap = {
  pageKey: string;
  columns: TableColumnConfig[];
  availableColumns: AvailableColumn[];
  savedConfig: TableViewConfig | null;
};

export type TableViewRow = {
  id: string;
  user_id: string;
  page_key: string;
  config: TableViewConfig;
  updated_at: string;
};

export const CUSTOM_FIELD_PREFIX = "custom_fields.";

export function isCustomFieldColumnId(id: string): boolean {
  return id.startsWith(CUSTOM_FIELD_PREFIX);
}

export function customFieldKeyFromColumnId(id: string): string | null {
  if (!isCustomFieldColumnId(id)) return null;
  return id.slice(CUSTOM_FIELD_PREFIX.length) || null;
}

export function customFieldColumnId(key: string): string {
  return `${CUSTOM_FIELD_PREFIX}${key}`;
}

export function parseTableViewConfig(raw: unknown): TableViewConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const columns = (raw as { columns?: unknown }).columns;
  if (!Array.isArray(columns)) return null;
  const out: TableColumnConfig[] = [];
  for (const item of columns) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== "string" || !c.id.trim()) continue;
    out.push({
      id: c.id.trim(),
      visible: c.visible !== false,
      width:
        typeof c.width === "number" && Number.isFinite(c.width)
          ? c.width
          : null
    });
  }
  return { columns: out };
}

/**
 * Merge saved config with defaults + currently available ids.
 * Unknown saved ids are dropped; new available ids append (hidden) at the end.
 */
export function mergeColumnsWithDefaults(
  saved: TableViewConfig | null,
  defaultColumns: TableColumnConfig[],
  availableIds: string[]
): TableColumnConfig[] {
  const available = new Set(availableIds);
  const defaultsById = new Map(defaultColumns.map((c) => [c.id, c]));

  if (!saved || saved.columns.length === 0) {
    const fromDefaults = defaultColumns
      .filter((c) => available.has(c.id) || defaultsById.has(c.id))
      .map((c) => ({ ...c }));
    const known = new Set(fromDefaults.map((c) => c.id));
    for (const id of availableIds) {
      if (known.has(id)) continue;
      fromDefaults.push({ id, visible: false, width: null });
    }
    return fromDefaults;
  }

  const result: TableColumnConfig[] = [];
  const seen = new Set<string>();
  for (const col of saved.columns) {
    if (!available.has(col.id) && !defaultsById.has(col.id)) continue;
    if (seen.has(col.id)) continue;
    seen.add(col.id);
    result.push({
      id: col.id,
      visible: col.visible,
      width: col.width ?? defaultsById.get(col.id)?.width ?? null
    });
  }
  for (const def of defaultColumns) {
    if (seen.has(def.id)) continue;
    if (!available.has(def.id) && !defaultsById.has(def.id)) continue;
    seen.add(def.id);
    result.push({ ...def });
  }
  for (const id of availableIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ id, visible: false, width: null });
  }
  return result;
}
