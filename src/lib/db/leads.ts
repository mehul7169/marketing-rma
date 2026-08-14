import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { computeLifecycleStatus } from "@/lib/leads/computeLifecycleStatus";
import { computeStage } from "@/lib/leads/computeStage";
import type { LeadListFilters, LeadRow } from "@/lib/leads/types";

function requireDb() {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  return supabaseAdmin;
}

function asLead(row: unknown): LeadRow {
  const r = row as LeadRow;
  const rawValue = r.deal_value as unknown;
  return {
    ...r,
    deal_value:
      rawValue === null || rawValue === undefined || rawValue === ""
        ? null
        : Number(rawValue)
  };
}

function stamp(existing: LeadRow, patch: Partial<LeadRow>): LeadRow {
  const merged: LeadRow = { ...existing, ...patch };
  const derived = {
    deal_closed: merged.deal_closed,
    post_call_status: merged.post_call_status,
    setter_verified: merged.setter_verified,
    call_booked_at: merged.call_booked_at,
    requalification_result: merged.requalification_result,
    requalification_attempted: merged.requalification_attempted,
    call_showed: merged.call_showed,
    qualified: merged.qualified,
    form_filled_at: merged.form_filled_at
  };
  merged.stage = computeStage(derived);
  merged.lifecycle_status = computeLifecycleStatus(derived);
  merged.updated_at = new Date().toISOString();
  return merged;
}

function firstSetAt(existing: string | null, nextValue: unknown, now: string): string | null {
  if (existing) return existing;
  if (nextValue === undefined || nextValue === null) return existing;
  return now;
}

export async function getLeadByEmail(email: string): Promise<LeadRow | null> {
  if (!supabaseAdmin) return null;
  const db = requireDb();
  const { data, error } = await db
    .from("leads")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  if (error) throw error;
  return data ? asLead(data) : null;
}

export async function getLeadById(id: string): Promise<LeadRow | null> {
  if (!supabaseAdmin) return null;
  const db = requireDb();
  const { data, error } = await db.from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? asLead(data) : null;
}

export async function insertLead(row: Partial<LeadRow> & { email: string }): Promise<LeadRow> {
  const db = requireDb();
  const now = new Date().toISOString();
  const base: LeadRow = {
    id: "",
    email: row.email.toLowerCase().trim(),
    ghl_contact_id: row.ghl_contact_id ?? null,
    name: row.name ?? null,
    phone: row.phone ?? null,
    created_at: now,
    utm_source: row.utm_source ?? null,
    utm_medium: row.utm_medium ?? null,
    utm_campaign: row.utm_campaign ?? null,
    utm_content: row.utm_content ?? null,
    utm_term: row.utm_term ?? null,
    ad_set_id: row.ad_set_id ?? null,
    lead_source: row.lead_source ?? null,
    describes_you: row.describes_you ?? null,
    biggest_goal: row.biggest_goal ?? null,
    monthly_revenue: row.monthly_revenue ?? null,
    investment_capacity: row.investment_capacity ?? null,
    form_filled_at: row.form_filled_at ?? null,
    form_answers: row.form_answers ?? null,
    qualified: row.qualified ?? null,
    qualified_at: row.qualified_at ?? null,
    qualified_by: row.qualified_by ?? null,
    call_booked_at: row.call_booked_at ?? null,
    call_scheduled_for: row.call_scheduled_for ?? null,
    cal_com_booking_id: row.cal_com_booking_id ?? null,
    call_cancelled_at: row.call_cancelled_at ?? null,
    setter_verified: row.setter_verified ?? null,
    setter_verified_at: row.setter_verified_at ?? null,
    setter_verified_by: row.setter_verified_by ?? null,
    reminder_sent: row.reminder_sent ?? false,
    reminder_sent_at: row.reminder_sent_at ?? null,
    call_showed: row.call_showed ?? null,
    call_showed_at: row.call_showed_at ?? null,
    call_showed_by: row.call_showed_by ?? null,
    deal_closed: row.deal_closed ?? null,
    deal_value: row.deal_value ?? null,
    closed_at: row.closed_at ?? null,
    closed_by: row.closed_by ?? null,
    notes: row.notes ?? null,
    stage: null,
    requalification_attempted: row.requalification_attempted ?? false,
    requalification_called_at: row.requalification_called_at ?? null,
    requalification_result: row.requalification_result ?? null,
    requalification_notes: row.requalification_notes ?? null,
    post_call_status: row.post_call_status ?? null,
    post_call_status_updated_at: row.post_call_status_updated_at ?? null,
    post_call_status_updated_by: row.post_call_status_updated_by ?? null,
    lifecycle_status: null,
    updated_at: now
  };
  const withStage = stamp(base, {});
  const { id: _omit, ...insertable } = withStage;
  void _omit;
  const { data, error } = await db.from("leads").insert(insertable).select("*").single();
  if (error) throw error;
  return asLead(data);
}

export async function updateLead(existing: LeadRow, patch: Partial<LeadRow>): Promise<LeadRow> {
  const db = requireDb();
  const now = new Date().toISOString();
  const next = stamp(existing, {
    ...patch,
    qualified_at:
      patch.qualified !== undefined
        ? firstSetAt(existing.qualified_at, patch.qualified, now)
        : existing.qualified_at,
    setter_verified_at:
      patch.setter_verified !== undefined
        ? firstSetAt(existing.setter_verified_at, patch.setter_verified, now)
        : existing.setter_verified_at,
    reminder_sent_at:
      patch.reminder_sent
        ? firstSetAt(existing.reminder_sent_at, patch.reminder_sent, now)
        : existing.reminder_sent_at,
    call_showed_at:
      patch.call_showed !== undefined
        ? firstSetAt(existing.call_showed_at, patch.call_showed, now)
        : existing.call_showed_at,
    closed_at:
      patch.deal_closed !== undefined
        ? firstSetAt(existing.closed_at, patch.deal_closed, now)
        : existing.closed_at
  });

  const { data, error } = await db
    .from("leads")
    .update({
      ...next,
      id: existing.id,
      email: existing.email,
      created_at: existing.created_at
    })
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw error;
  return asLead(data);
}

export async function listLeads(filters: LeadListFilters): Promise<LeadRow[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  let query = db.from("leads").select("*").order("created_at", { ascending: false });

  if (filters.fromISO) query = query.gte("created_at", `${filters.fromISO}T00:00:00.000Z`);
  if (filters.toISO) query = query.lte("created_at", `${filters.toISO}T23:59:59.999Z`);
  if (filters.stages && filters.stages.length > 0) query = query.in("stage", filters.stages);
  if (filters.sources && filters.sources.length > 0) {
    query = query.in("lead_source", filters.sources);
  }
  if (filters.needsRequal) {
    query = query
      .eq("qualified", false)
      .or("requalification_attempted.eq.false,requalification_attempted.is.null");
  } else if (filters.lifecycle && filters.lifecycle !== "all") {
    if (filters.lifecycle === "active") {
      query = query.or("lifecycle_status.eq.active,lifecycle_status.is.null");
    } else {
      query = query.eq("lifecycle_status", filters.lifecycle);
    }
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().replace(/[%_,]/g, " ");
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as LeadRow[];
}

export async function listDistinctLeadSources(): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  const { data, error } = await db.from("leads").select("lead_source");
  if (error) throw error;
  const set = new Set<string>();
  for (const row of (data ?? []) as Array<{ lead_source: string | null }>) {
    if (row.lead_source) set.add(row.lead_source);
  }
  return Array.from(set).sort();
}

export async function listLeadsInRange(fromISO: string, toISO: string, sources?: string[]): Promise<LeadRow[]> {
  return listLeads({ fromISO, toISO, sources });
}

/** All leads, optionally by source. Date windows are applied per-metric in insights. */
export async function listAllLeads(sources?: string[]): Promise<LeadRow[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  const pageSize = 1000;
  const all: LeadRow[] = [];
  let offset = 0;
  for (;;) {
    let query = db.from("leads").select("*").range(offset, offset + pageSize - 1);
    if (sources && sources.length > 0) query = query.in("lead_source", sources);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []).map(asLead);
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}
