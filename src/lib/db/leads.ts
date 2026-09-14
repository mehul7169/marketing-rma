import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { listLeadIdsWithDueFollowUps } from "@/lib/db/lead_reminders";
import {
  computeActionStatus,
  inferLastCallOutcome
} from "@/lib/leads/actionStatus";
import { computeLifecycleStatus } from "@/lib/leads/computeLifecycleStatus";
import { computeStage } from "@/lib/leads/computeStage";
import { omitLegacyLeadColumns } from "@/lib/leads/customFields";
import {
  funnelEventField,
  leadMatchesFunnelStage,
  parseUrlEvent
} from "@/lib/leads/stageEvents";
import type {
  BookingHistoryEntry,
  BookingSource,
  LeadListFilters,
  LeadRow
} from "@/lib/leads/types";
import { istDayEndUtcIso, istDayStartUtcIso, todayISTDateString } from "@/lib/timezone";

function requireDb() {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  return supabaseAdmin;
}

function parseBookingHistory(raw: unknown): BookingHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: BookingHistoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    if (typeof e.new_scheduled_for !== "string") continue;
    const source: BookingSource = e.source === "cal_com" ? "cal_com" : "manual";
    out.push({
      changed_at: typeof e.changed_at === "string" ? e.changed_at : "",
      previous_scheduled_for:
        typeof e.previous_scheduled_for === "string" ? e.previous_scheduled_for : null,
      new_scheduled_for: e.new_scheduled_for,
      source,
      changed_by: typeof e.changed_by === "string" ? e.changed_by : ""
    });
  }
  return out;
}

function parseBookingSource(raw: unknown): BookingSource | null {
  if (raw === "cal_com" || raw === "manual") return raw;
  return null;
}

function asLead(row: unknown): LeadRow {
  const raw = omitLegacyLeadColumns(
    (row && typeof row === "object" ? { ...(row as object) } : {}) as Record<
      string,
      unknown
    >
  );
  const r = raw as unknown as LeadRow;
  const rawValue = r.deal_value as unknown;
  const attemptsRaw = (r as LeadRow).verification_call_attempts as unknown;
  const attempts =
    typeof attemptsRaw === "number"
      ? attemptsRaw
      : attemptsRaw === null || attemptsRaw === undefined || attemptsRaw === ""
        ? 0
        : Number(attemptsRaw);
  const statusRaw = (r as LeadRow).verification_call_status;
  const status: LeadRow["verification_call_status"] =
    statusRaw === "no_answer" ||
    statusRaw === "follow_up_needed" ||
    statusRaw === "reached" ||
    statusRaw === "not_contacted"
      ? statusRaw
      : "not_contacted";
  const contactAttemptsRaw = (r as LeadRow).contact_attempts as unknown;
  const contactAttempts =
    typeof contactAttemptsRaw === "number"
      ? contactAttemptsRaw
      : contactAttemptsRaw === null ||
          contactAttemptsRaw === undefined ||
          contactAttemptsRaw === ""
        ? 0
        : Number(contactAttemptsRaw);

  return {
    ...r,
    deal_value:
      rawValue === null || rawValue === undefined || rawValue === ""
        ? null
        : Number(rawValue),
    verification_call_status: status,
    verification_call_attempts: Number.isFinite(attempts) ? attempts : 0,
    last_verification_call_at: (r as LeadRow).last_verification_call_at ?? null,
    booking_source: parseBookingSource((r as LeadRow).booking_source),
    booking_history: parseBookingHistory((r as LeadRow).booking_history),
    slack_form_notified: Boolean((r as LeadRow).slack_form_notified),
    slack_booking_notified: Boolean((r as LeadRow).slack_booking_notified),
    slack_no_booking_notified: Boolean((r as LeadRow).slack_no_booking_notified),
    action_status: (r as LeadRow).action_status ?? null,
    is_dead: Boolean((r as LeadRow).is_dead),
    dead_reason: (r as LeadRow).dead_reason ?? null,
    contact_attempts: Number.isFinite(contactAttempts) ? contactAttempts : 0,
    call_confirmed:
      (r as LeadRow).call_confirmed === true
        ? true
        : (r as LeadRow).call_confirmed === false
          ? false
          : null,
    next_action_at: (r as LeadRow).next_action_at ?? null,
    last_action: (r as LeadRow).last_action ?? null,
    last_action_at: (r as LeadRow).last_action_at ?? null,
    custom_fields:
      r.custom_fields &&
      typeof r.custom_fields === "object" &&
      !Array.isArray(r.custom_fields)
        ? (r.custom_fields as Record<string, unknown>)
        : {}
  };
}

function stamp(existing: LeadRow, patch: Partial<LeadRow>): LeadRow {
  const merged: LeadRow = { ...existing, ...patch };
  merged.stage = computeStage({
    deal_closed: merged.deal_closed,
    is_dead: Boolean(merged.is_dead),
    post_call_status: merged.post_call_status,
    call_showed: merged.call_showed,
    call_confirmed: merged.call_confirmed,
    call_booked_at: merged.call_booked_at
  });
  merged.lifecycle_status = computeLifecycleStatus({
    deal_closed: merged.deal_closed,
    is_dead: Boolean(merged.is_dead),
    call_booked_at: merged.call_booked_at,
    qualified: merged.qualified
  });
  // Explicit action_status in patch wins (e.g. revive → Untouched).
  if (patch.action_status === undefined) {
    merged.action_status = computeActionStatus(
      {
        deal_closed: merged.deal_closed,
        is_dead: Boolean(merged.is_dead),
        next_action_at: merged.next_action_at,
        contact_attempts: merged.contact_attempts ?? 0,
        call_confirmed: merged.call_confirmed,
        call_booked_at: merged.call_booked_at,
        last_action: merged.last_action
      },
      inferLastCallOutcome(merged.last_action)
    );
  }
  merged.updated_at = new Date().toISOString();
  return merged;
}

function firstSetAt(existing: string | null, nextValue: unknown, now: string): string | null {
  if (existing) return existing;
  if (nextValue === undefined || nextValue === null) return existing;
  return now;
}

export async function getLeadByEmail(email: string, orgId: string): Promise<LeadRow | null> {
  if (!supabaseAdmin) return null;
  const db = requireDb();
  const { data, error } = await db
    .from("leads")
    .select("*")
    .eq("org_id", orgId)
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  if (error) throw error;
  return data ? asLead(data) : null;
}

/** Match by phone within an org (exact trim, then digits-only fallback). */
export async function getLeadByPhone(
  phone: string,
  orgId: string
): Promise<LeadRow | null> {
  if (!supabaseAdmin) return null;
  const db = requireDb();
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const { data: exact, error: exactError } = await db
    .from("leads")
    .select("*")
    .eq("org_id", orgId)
    .eq("phone", trimmed)
    .limit(1)
    .maybeSingle();
  if (exactError) throw exactError;
  if (exact) return asLead(exact);

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;

  const { data: rows, error } = await db
    .from("leads")
    .select("*")
    .eq("org_id", orgId)
    .not("phone", "is", null)
    .limit(200);
  if (error) throw error;
  const match = (rows ?? []).find((row) => {
    const p = String((row as { phone?: string | null }).phone ?? "").replace(
      /\D/g,
      ""
    );
    return p === digits || p.endsWith(digits) || digits.endsWith(p);
  });
  return match ? asLead(match) : null;
}

export async function getLeadById(id: string, orgId: string): Promise<LeadRow | null> {
  if (!supabaseAdmin) return null;
  const db = requireDb();
  const { data, error } = await db
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data ? asLead(data) : null;
}

export async function insertLead(
  row: Partial<LeadRow> & { email: string; org_id: string }
): Promise<LeadRow> {
  const db = requireDb();
  const now = new Date().toISOString();
  if (!row.org_id) throw new Error("insertLead requires org_id");
  const base: LeadRow = {
    id: "",
    org_id: row.org_id,
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
    form_filled_at: row.form_filled_at ?? null,
    custom_fields: row.custom_fields ?? {},
    qualified: row.qualified ?? null,
    qualified_at: row.qualified_at ?? null,
    qualified_by: row.qualified_by ?? null,
    call_booked_at: row.call_booked_at ?? null,
    call_scheduled_for: row.call_scheduled_for ?? null,
    cal_com_booking_id: row.cal_com_booking_id ?? null,
    booking_source: row.booking_source ?? null,
    booking_history: row.booking_history ?? [],
    call_cancelled_at: row.call_cancelled_at ?? null,
    setter_verified: row.setter_verified ?? null,
    setter_verified_at: row.setter_verified_at ?? null,
    setter_verified_by: row.setter_verified_by ?? null,
    verification_call_status: row.verification_call_status ?? "not_contacted",
    verification_call_attempts: row.verification_call_attempts ?? 0,
    last_verification_call_at: row.last_verification_call_at ?? null,
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
    recording_url: row.recording_url ?? null,
    stage: null,
    requalification_attempted: row.requalification_attempted ?? false,
    requalification_called_at: row.requalification_called_at ?? null,
    requalification_result: row.requalification_result ?? null,
    requalification_notes: row.requalification_notes ?? null,
    post_call_status: row.post_call_status ?? null,
    post_call_status_updated_at: row.post_call_status_updated_at ?? null,
    post_call_status_updated_by: row.post_call_status_updated_by ?? null,
    lifecycle_status: null,
    action_status: row.action_status ?? null,
    is_dead: row.is_dead ?? false,
    dead_reason: row.dead_reason ?? null,
    contact_attempts: row.contact_attempts ?? 0,
    call_confirmed: row.call_confirmed ?? null,
    next_action_at: row.next_action_at ?? null,
    last_action: row.last_action ?? null,
    last_action_at: row.last_action_at ?? null,
    slack_form_notified: row.slack_form_notified ?? false,
    slack_booking_notified: row.slack_booking_notified ?? false,
    slack_no_booking_notified: row.slack_no_booking_notified ?? false,
    updated_at: now
  };
  const withStage = stamp(base, {});
  const { id: _omit, ...insertable } = withStage;
  void _omit;
  const { data, error } = await db
    .from("leads")
    .insert(omitLegacyLeadColumns(insertable as unknown as Record<string, unknown>))
    .select("*")
    .single();
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
      patch.call_showed === null
        ? null
        : patch.call_showed !== undefined
          ? firstSetAt(existing.call_showed_at, patch.call_showed, now)
          : patch.call_showed_at !== undefined
            ? patch.call_showed_at
            : existing.call_showed_at,
    closed_at:
      patch.deal_closed !== undefined
        ? firstSetAt(existing.closed_at, patch.deal_closed, now)
        : existing.closed_at
  });

  const { data, error } = await db
    .from("leads")
    .update(
      omitLegacyLeadColumns({
        ...next,
        id: existing.id,
        org_id: existing.org_id,
        email: existing.email,
        created_at: existing.created_at
      } as unknown as Record<string, unknown>)
    )
    .eq("id", existing.id)
    .eq("org_id", existing.org_id)
    .select("*")
    .single();
  if (error) throw error;
  return asLead(data);
}

export async function scheduleLeadCall(
  existing: LeadRow,
  scheduledForIso: string,
  changedBy: string
): Promise<LeadRow> {
  const now = new Date().toISOString();
  const entry: BookingHistoryEntry = {
    changed_at: now,
    previous_scheduled_for: existing.call_scheduled_for,
    new_scheduled_for: scheduledForIso,
    source: "manual",
    changed_by: changedBy
  };
  return updateLead(existing, {
    call_scheduled_for: scheduledForIso,
    booking_source: "manual",
    booking_history: [...existing.booking_history, entry],
    call_booked_at: existing.call_booked_at ?? now
  });
}

export async function listLeads(filters: LeadListFilters): Promise<LeadRow[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();

  // cohort: created_at in range + ever reached stage (Overview funnel deep link).
  // event: event timestamp in range (legacy).
  // stage: current state + created_at (manual Stage dropdown).
  const cohortStage = parseUrlEvent(filters.cohort);
  const eventStage = cohortStage ? null : parseUrlEvent(filters.event);
  const dateField = eventStage ? funnelEventField(eventStage) : "created_at";

  if (!filters.orgId) throw new Error("listLeads requires orgId");

  let query = db.from("leads").select("*").eq("org_id", filters.orgId);

  if (filters.needsVerificationCall) {
    // Operational queue — not clipped by the page date range.
    // Never-contacted (null last_verification_call_at) first, then oldest tries.
    query = query
      .not("call_booked_at", "is", null)
      .is("setter_verified", null)
      .or(
        "verification_call_status.is.null,verification_call_status.eq.not_contacted,verification_call_status.eq.no_answer,verification_call_status.eq.follow_up_needed"
      )
      .order("last_verification_call_at", { ascending: true, nullsFirst: true });
  } else {
    query = query.order(dateField, { ascending: false });
  }

  if (filters.followUpsDue) {
    const dueIds = await listLeadIdsWithDueFollowUps(filters.orgId);
    if (dueIds.length === 0) return [];
    query = query.in("id", dueIds);
  } else if (!filters.needsVerificationCall) {
    if (filters.fromISO) query = query.gte(dateField, istDayStartUtcIso(filters.fromISO));
    if (filters.toISO) query = query.lte(dateField, istDayEndUtcIso(filters.toISO));
    if (eventStage && dateField !== "created_at") {
      query = query.not(dateField, "is", null);
    }
  }

  if (cohortStage) {
    if (cohortStage === "call_booked") query = query.not("call_booked_at", "is", null);
    if (cohortStage === "qualified_call_booked") {
      query = query.eq("call_confirmed", true).not("call_booked_at", "is", null);
    }
    if (cohortStage === "show_up") query = query.eq("call_showed", true);
    if (cohortStage === "closed") query = query.eq("deal_closed", true);
  } else if (eventStage) {
    if (eventStage === "qualified_call_booked") {
      query = query.eq("call_confirmed", true).not("call_booked_at", "is", null);
    }
    if (eventStage === "show_up") query = query.eq("call_showed", true);
    if (eventStage === "closed") query = query.eq("deal_closed", true);
  } else if (filters.stages && filters.stages.length > 0) {
    query = query.in("stage", filters.stages);
  }

  if (filters.sources && filters.sources.length > 0) {
    query = query.in("lead_source", filters.sources);
  }
  if (filters.needsRequal) {
    query = query
      .eq("qualified", false)
      .or("requalification_attempted.eq.false,requalification_attempted.is.null");
  } else if (
    !filters.needsVerificationCall &&
    filters.lifecycle &&
    filters.lifecycle !== "all"
  ) {
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

  if (filters.excludeDeadAndClosed) {
    query = query
      .eq("is_dead", false)
      .or("deal_closed.is.null,deal_closed.eq.false");
  }
  if (filters.isDead === true) {
    query = query.eq("is_dead", true);
  } else if (filters.isDead === false) {
    query = query.eq("is_dead", false);
  }
  if (filters.actionStatuses && filters.actionStatuses.length > 0) {
    const wantsUntouched = filters.actionStatuses.includes("Untouched");
    const others = filters.actionStatuses.filter((s) => s !== "Untouched");
    if (wantsUntouched && others.length === 0) {
      query = query.or("action_status.is.null,action_status.eq.Untouched");
    } else if (wantsUntouched && others.length > 0) {
      const parts = [
        "action_status.is.null",
        ...filters.actionStatuses.map((s) => `action_status.eq.${s}`)
      ];
      query = query.or(parts.join(","));
    } else {
      query = query.in("action_status", others);
    }
  }
  if (filters.upcomingOnly) {
    const afterToday = istDayEndUtcIso(todayISTDateString());
    query = query
      .not("next_action_at", "is", null)
      .gt("next_action_at", afterToday);
  }

  const { data, error } = await query;
  if (error) throw error;
  let rows = (data ?? []).map(asLead);

  if (eventStage === "call_booked" && filters.fromISO && filters.toISO) {
    rows = rows.filter((lead) =>
      leadMatchesFunnelStage(lead, "call_booked", filters.fromISO!, filters.toISO!)
    );
  }

  if (filters.needsVerificationCall) {
    rows = [...rows].sort((a, b) => {
      const aAt = a.last_verification_call_at;
      const bAt = b.last_verification_call_at;
      if (!aAt && !bAt) return 0;
      if (!aAt) return -1;
      if (!bAt) return 1;
      return aAt < bAt ? -1 : aAt > bAt ? 1 : 0;
    });
  }

  return rows;
}

export async function listDistinctLeadSources(orgId: string): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  const { data, error } = await db
    .from("leads")
    .select("lead_source")
    .eq("org_id", orgId);
  if (error) throw error;
  const set = new Set<string>();
  for (const row of (data ?? []) as Array<{ lead_source: string | null }>) {
    if (row.lead_source) set.add(row.lead_source);
  }
  return Array.from(set).sort();
}

/** Distinct keys present in leads.custom_fields for an org (for column picker). */
export async function listDistinctCustomFieldKeys(
  orgId: string
): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  const keys = new Set<string>();
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await db
      .from("leads")
      .select("custom_fields")
      .eq("org_id", orgId)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      const cf = (row as { custom_fields?: unknown }).custom_fields;
      if (!cf || typeof cf !== "object" || Array.isArray(cf)) continue;
      for (const key of Object.keys(cf as Record<string, unknown>)) {
        if (key.trim()) keys.add(key);
      }
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

export async function listLeadsInRange(
  fromISO: string,
  toISO: string,
  orgId: string,
  sources?: string[]
): Promise<LeadRow[]> {
  return listLeads({ orgId, fromISO, toISO, sources });
}

/** All leads, optionally by source. Cohort/event windows applied in computeInsights. */
export async function listAllLeads(orgId: string, sources?: string[]): Promise<LeadRow[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  const pageSize = 1000;
  const all: LeadRow[] = [];
  let offset = 0;
  for (;;) {
    let query = db
      .from("leads")
      .select("*")
      .eq("org_id", orgId)
      .range(offset, offset + pageSize - 1);
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

export async function listLeadsNeedingSlackNoBookingNudge(
  delayMinutes: number
): Promise<LeadRow[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  const cutoff = new Date(Date.now() - delayMinutes * 60_000).toISOString();
  const { data, error } = await db
    .from("leads")
    .select("*")
    .eq("qualified", true)
    .is("call_booked_at", null)
    .eq("slack_no_booking_notified", false)
    .not("form_filled_at", "is", null)
    .lte("form_filled_at", cutoff);
  if (error) throw error;
  return (data ?? []).map(asLead);
}

export async function markSlackNoBookingNotified(id: string): Promise<void> {
  const db = requireDb();
  const { error } = await db
    .from("leads")
    .update({ slack_no_booking_notified: true })
    .eq("id", id);
  if (error) throw error;
}
