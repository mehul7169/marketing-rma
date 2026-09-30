import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import {
  parseTableViewConfig,
  type TableViewConfig,
  type TableViewRow
} from "@/lib/table-views/types";

function requireDb() {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  return supabaseAdmin;
}

function asRow(raw: unknown): TableViewRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.user_id !== "string") return null;
  if (typeof r.page_key !== "string") return null;
  const config = parseTableViewConfig(r.config);
  if (!config) return null;
  return {
    id: r.id,
    user_id: r.user_id,
    page_key: r.page_key,
    config,
    updated_at:
      typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString()
  };
}

/** Returns null when the user has never customized this page. */
export async function getTableViewForUser(
  userId: string,
  pageKey: string
): Promise<TableViewRow | null> {
  if (!supabaseAdmin) return null;
  const db = requireDb();
  const { data, error } = await db
    .from("table_views")
    .select("*")
    .eq("user_id", userId)
    .eq("page_key", pageKey)
    .maybeSingle();
  if (error) throw error;
  return asRow(data);
}

export async function upsertTableViewForUser(
  userId: string,
  pageKey: string,
  config: TableViewConfig
): Promise<TableViewRow> {
  const db = requireDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("table_views")
    .upsert(
      {
        user_id: userId,
        page_key: pageKey,
        config,
        updated_at: now
      },
      { onConflict: "user_id,page_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  const row = asRow(data);
  if (!row) throw new Error("Failed to parse saved table view");
  return row;
}

/** Saves column layout, keeping any remembered filters on the same row. */
export async function saveTableViewColumns(
  userId: string,
  pageKey: string,
  columns: TableViewConfig["columns"]
): Promise<TableViewRow> {
  const existing = await getTableViewForUser(userId, pageKey);
  return upsertTableViewForUser(userId, pageKey, {
    ...existing?.config,
    columns
  });
}

/** Remembers last-used filters for one org, keeping column layout intact. */
export async function saveTableViewFilters(
  userId: string,
  pageKey: string,
  orgId: string,
  filters: Record<string, string>
): Promise<void> {
  const existing = await getTableViewForUser(userId, pageKey);
  const config: TableViewConfig = {
    columns: existing?.config.columns ?? [],
    filters: { ...existing?.config.filters, [orgId]: filters }
  };
  await upsertTableViewForUser(userId, pageKey, config);
}

export async function getTableViewFilters(
  userId: string,
  pageKey: string,
  orgId: string
): Promise<Record<string, string> | null> {
  const row = await getTableViewForUser(userId, pageKey);
  return row?.config.filters?.[orgId] ?? null;
}

/** Clears saved columns so the client falls back to page defaults; filters survive. */
export async function deleteTableViewForUser(
  userId: string,
  pageKey: string
): Promise<void> {
  const db = requireDb();
  const existing = await getTableViewForUser(userId, pageKey);
  if (existing?.config.filters) {
    await upsertTableViewForUser(userId, pageKey, {
      columns: [],
      filters: existing.config.filters
    });
    return;
  }
  const { error } = await db
    .from("table_views")
    .delete()
    .eq("user_id", userId)
    .eq("page_key", pageKey);
  if (error) throw error;
}
