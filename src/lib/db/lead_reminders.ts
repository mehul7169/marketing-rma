import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import type { LeadReminder } from "@/lib/leads/types";
import { istDayEndUtcIso, todayISTDateString } from "@/lib/timezone";

function requireDb() {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  return supabaseAdmin;
}

function asReminder(row: unknown): LeadReminder {
  const r = row as LeadReminder;
  return {
    id: r.id,
    org_id: String(r.org_id ?? ""),
    lead_id: r.lead_id,
    text: r.text,
    due_at: r.due_at ?? null,
    created_at: r.created_at,
    created_by: r.created_by ?? null,
    resolved: Boolean(r.resolved),
    resolved_at: r.resolved_at ?? null
  };
}

export async function listRemindersForLead(
  leadId: string,
  orgId: string
): Promise<LeadReminder[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  const { data, error } = await db
    .from("lead_reminders")
    .select("*")
    .eq("org_id", orgId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(asReminder);
}

/** Unresolved reminders due today (IST) or earlier, for badge + daily filter. */
export async function listDueFollowUps(
  orgId: string,
  leadIds?: string[]
): Promise<LeadReminder[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  const until = istDayEndUtcIso(todayISTDateString());
  let query = db
    .from("lead_reminders")
    .select("*")
    .eq("org_id", orgId)
    .eq("resolved", false)
    .not("due_at", "is", null)
    .lte("due_at", until)
    .order("due_at", { ascending: true });
  if (leadIds) {
    if (leadIds.length === 0) return [];
    query = query.in("lead_id", leadIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(asReminder);
}

export async function listLeadIdsWithDueFollowUps(orgId: string): Promise<string[]> {
  const rows = await listDueFollowUps(orgId);
  return Array.from(new Set(rows.map((r) => r.lead_id)));
}

export async function insertLeadReminder(input: {
  org_id: string;
  lead_id: string;
  text: string;
  due_at: string | null;
  created_by: string;
}): Promise<LeadReminder> {
  const db = requireDb();
  if (!input.org_id) throw new Error("insertLeadReminder requires org_id");
  const { data, error } = await db
    .from("lead_reminders")
    .insert({
      org_id: input.org_id,
      lead_id: input.lead_id,
      text: input.text,
      due_at: input.due_at,
      created_by: input.created_by,
      resolved: false
    })
    .select("*")
    .single();
  if (error) throw error;
  return asReminder(data);
}

export async function resolveLeadReminder(
  id: string,
  orgId: string
): Promise<LeadReminder> {
  const db = requireDb();
  const { data, error } = await db
    .from("lead_reminders")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();
  if (error) throw error;
  return asReminder(data);
}
