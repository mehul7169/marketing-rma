import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import type { LeadActivityType } from "@/lib/leads/actionStatus";

export type LeadActivityRow = {
  id: string;
  org_id: string;
  lead_id: string;
  type: LeadActivityType | string;
  outcome: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

function requireDb() {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  return supabaseAdmin;
}

function asActivity(row: unknown): LeadActivityRow {
  const r = row as LeadActivityRow;
  return {
    id: r.id,
    org_id: String(r.org_id ?? ""),
    lead_id: r.lead_id,
    type: r.type,
    outcome: r.outcome ?? null,
    note: r.note ?? null,
    created_at: r.created_at,
    created_by: r.created_by ?? null
  };
}

export async function insertLeadActivity(input: {
  org_id: string;
  lead_id: string;
  type: LeadActivityType | string;
  outcome?: string | null;
  note?: string | null;
  created_by?: string | null;
}): Promise<LeadActivityRow> {
  const db = requireDb();
  if (!input.org_id) throw new Error("insertLeadActivity requires org_id");
  const { data, error } = await db
    .from("lead_activities")
    .insert({
      org_id: input.org_id,
      lead_id: input.lead_id,
      type: input.type,
      outcome: input.outcome ?? null,
      note: input.note?.trim() ? input.note.trim() : null,
      created_by: input.created_by ?? null
    })
    .select("*")
    .single();
  if (error) throw error;
  return asActivity(data);
}

export async function listLeadActivities(
  leadId: string,
  orgId: string,
  opts?: { limit?: number }
): Promise<LeadActivityRow[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  let query = db
    .from("lead_activities")
    .select("*")
    .eq("org_id", orgId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (opts?.limit && opts.limit > 0) {
    query = query.limit(opts.limit);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(asActivity);
}

export async function listRecentLeadActivitiesForLeads(
  leadIds: string[],
  orgId: string,
  perLead = 5
): Promise<Map<string, LeadActivityRow[]>> {
  const map = new Map<string, LeadActivityRow[]>();
  if (!supabaseAdmin || leadIds.length === 0) return map;
  const db = requireDb();
  const { data, error } = await db
    .from("lead_activities")
    .select("*")
    .eq("org_id", orgId)
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(leadIds.length * perLead, perLead));
  if (error) throw error;
  for (const row of data ?? []) {
    const activity = asActivity(row);
    const list = map.get(activity.lead_id) ?? [];
    if (list.length < perLead) {
      list.push(activity);
      map.set(activity.lead_id, list);
    }
  }
  return map;
}
