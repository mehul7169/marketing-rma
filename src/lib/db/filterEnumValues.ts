/**
 * Cached distinct enum values per org for the custom-filter picker.
 * Same 5-minute TTL pattern as custom-field keys.
 */

import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

const TTL_MS = 5 * 60 * 1000;

export type FilterEnumValueMap = Partial<
  Record<"lead_source" | "post_call_status" | "dead_reason" | "booking_source", string[]>
>;

type Entry = { values: FilterEnumValueMap; expires: number };
const cache = new Map<string, Entry>();

const COLUMNS: Array<keyof FilterEnumValueMap> = [
  "lead_source",
  "post_call_status",
  "dead_reason",
  "booking_source"
];

export function peekFilterEnumValuesCache(orgId: string): FilterEnumValueMap | null {
  const hit = cache.get(orgId);
  if (!hit || hit.expires <= Date.now()) return null;
  return hit.values;
}

export async function listFilterEnumValues(orgId: string): Promise<FilterEnumValueMap> {
  const cached = peekFilterEnumValuesCache(orgId);
  if (cached) return cached;
  if (!supabaseAdmin) return {};
  const out: FilterEnumValueMap = {};
  await Promise.all(
    COLUMNS.map(async (col) => {
      const { data, error } = await supabaseAdmin!
        .from("leads")
        .select(col)
        .eq("org_id", orgId)
        .not(col, "is", null);
      if (error) throw error;
      const set = new Set<string>();
      for (const row of data ?? []) {
        const v = (row as Record<string, unknown>)[col];
        if (typeof v === "string" && v.trim()) set.add(v.trim());
      }
      out[col] = Array.from(set).sort((a, b) => a.localeCompare(b));
    })
  );
  cache.set(orgId, { values: out, expires: Date.now() + TTL_MS });
  return out;
}
