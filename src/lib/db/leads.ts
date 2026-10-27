import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { computeStage } from "@/lib/leads/computeStage";
import {
  mergeCustomFields,
  omitLegacyLeadColumns
} from "@/lib/leads/customFields";
import {
  peekCustomFieldKeysCache,
  putCustomFieldKeysCache,
  rememberCustomFieldKeys
} from "@/lib/leads/customFieldKeysCache";
import { KPI_DEFINITIONS } from "@/lib/leads/lifecycleDefinitions";
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
    is_dead: Boolean((r as LeadRow).is_dead),
    dead_reason: (r as LeadRow).dead_reason ?? null,
    contact_attempts: Number.isFinite(contactAttempts) ? contactAttempts : 0,
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
    qualified: merged.qualified,
    call_booked_at: merged.call_booked_at
  });
  merged.updated_at = new Date().toISOString();
  return merged;
}

/** Postgres-computed columns reject any written value (error 428C9). */
const GENERATED_LEAD_COLUMNS = ["pipeline_stage"] as const;

export function omitGeneratedLeadColumns<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const key of GENERATED_LEAD_COLUMNS) delete out[key];
  return out as T;
}

function firstSetAt(existing: string | null, nextValue: unknown, now: string): string | null {
  if (existing) return existing;
  if (nextValue === undefined || nextValue === null) return existing;
  return now;
}

/** Single-lead reads (drawer, writes). Explicit columns — never select("*"). */
const LEAD_FULL_SELECT = [
  "id",
  "org_id",
  "email",
  "ghl_contact_id",
  "name",
  "phone",
  "created_at",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ad_set_id",
  "lead_source",
  "form_filled_at",
  "custom_fields",
  "form_qualified",
  "first_contacted_at",
  "pipeline_stage",
  "qualified",
  "qualified_at",
  "qualified_by",
  "call_booked_at",
  "call_scheduled_for",
  "cal_com_booking_id",
  "booking_source",
  "booking_history",
  "verification_call_status",
  "verification_call_attempts",
  "last_verification_call_at",
  "reminder_sent",
  "reminder_sent_at",
  "call_showed",
  "call_showed_at",
  "call_showed_by",
  "deal_closed",
  "deal_value",
  "closed_at",
  "closed_by",
  "notes",
  "recording_url",
  "stage",
  "requalification_attempted",
  "requalification_called_at",
  "requalification_result",
  "requalification_notes",
  "post_call_status",
  "post_call_status_updated_at",
  "post_call_status_updated_by",
  "is_dead",
  "dead_reason",
  "contact_attempts",
  "next_action_at",
  "last_action",
  "last_action_at",
  "updated_at",
  "slack_form_notified",
  "slack_booking_notified",
  "slack_no_booking_notified"
].join(",");

/** List/queue views — skip verification, requalification, slack, booking_history. */
const LEAD_LIST_SELECT = [
  "id",
  "org_id",
  "email",
  "name",
  "phone",
  "created_at",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ad_set_id",
  "lead_source",
  "form_filled_at",
  "custom_fields",
  "form_qualified",
  "first_contacted_at",
  "pipeline_stage",
  "qualified",
  "qualified_at",
  "qualified_by",
  "call_booked_at",
  "call_scheduled_for",
  "booking_source",
  "reminder_sent",
  "reminder_sent_at",
  "call_showed",
  "call_showed_at",
  "call_showed_by",
  "deal_closed",
  "deal_value",
  "notes",
  "recording_url",
  "stage",
  "post_call_status",
  "is_dead",
  "dead_reason",
  "contact_attempts",
  "next_action_at",
  "last_action",
  "last_action_at",
  "updated_at"
].join(",");

export async function getLeadByEmail(email: string, orgId: string): Promise<LeadRow | null> {
  if (!supabaseAdmin) return null;
  const db = requireDb();
  const { data, error } = await db
    .from("leads")
    .select(LEAD_FULL_SELECT)
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
    .select(LEAD_FULL_SELECT)
    .eq("org_id", orgId)
    .eq("phone", trimmed)
    .limit(1)
    .maybeSingle();
  if (exactError) throw exactError;
  if (exact) return asLead(exact);

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;

  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data: rows, error } = await db
      .from("leads")
      .select("id,phone")
      .eq("org_id", orgId)
      .not("phone", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const match = (rows ?? []).find((row) =>
      phoneDigitsMatch(String((row as { phone?: string | null }).phone ?? ""), digits)
    );
    if (match) return getLeadById((match as { id: string }).id, orgId);
    if (!rows || rows.length < pageSize) return null;
  }
}

/** Digits-only compare tolerant of country-code prefixes (+91…). */
export function phoneDigitsMatch(stored: string, digits: string): boolean {
  const p = stored.replace(/\D/g, "");
  if (p.length < 7) return false;
  return p === digits || p.endsWith(digits) || digits.endsWith(p);
}

export async function getLeadById(id: string, orgId: string): Promise<LeadRow | null> {
  if (!supabaseAdmin) return null;
  const db = requireDb();
  const { data, error } = await db
    .from("leads")
    .select(LEAD_FULL_SELECT)
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
    form_qualified: row.form_qualified ?? null,
    first_contacted_at: row.first_contacted_at ?? null,
    qualified: row.qualified ?? null,
    qualified_at: row.qualified_at ?? null,
    qualified_by: row.qualified_by ?? null,
    call_booked_at: row.call_booked_at ?? null,
    call_scheduled_for: row.call_scheduled_for ?? null,
    cal_com_booking_id: row.cal_com_booking_id ?? null,
    booking_source: row.booking_source ?? null,
    booking_history: row.booking_history ?? [],
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
    is_dead: row.is_dead ?? false,
    dead_reason: row.dead_reason ?? null,
    contact_attempts: row.contact_attempts ?? 0,
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
    .select(LEAD_FULL_SELECT)
    .single();
  if (error) throw error;
  const created = asLead(data);
  rememberCustomFieldKeys(created.org_id, Object.keys(created.custom_fields ?? {}));
  return created;
}

/** Sheet/form fields safe to refresh on re-ingest. Never includes workflow columns. */
export type LeadSheetUpsertFields = {
  name?: string | null;
  phone?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  lead_source?: string | null;
  ad_set_id?: string | null;
  ghl_contact_id?: string | null;
  custom_fields?: Record<string, unknown>;
  form_filled_at?: string | null;
};

/**
 * True upsert on UNIQUE (org_id, email).
 * On conflict: refreshes sheet-sourced fields only (phone only if existing is empty).
 * Workflow fields (qualified, call_*, stage, notes, …) are never in the
 * upsert payload, so re-sync cannot clobber CRM progress.
 */
export async function upsertLeadByOrgEmail(
  orgId: string,
  email: string,
  sheet: LeadSheetUpsertFields
): Promise<{ lead: LeadRow; action: "created" | "updated" }> {
  const db = requireDb();
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) throw new Error("upsertLeadByOrgEmail requires email");
  if (!orgId) throw new Error("upsertLeadByOrgEmail requires orgId");

  const existing = await getLeadByEmail(normalizedEmail, orgId);
  const now = new Date().toISOString();

  const phone =
    existing?.phone && existing.phone.trim()
      ? existing.phone
      : sheet.phone?.trim()
        ? sheet.phone.trim()
        : null;

  const custom_fields = mergeCustomFields(
    existing?.custom_fields,
    sheet.custom_fields ?? {}
  );

  const payload: Record<string, unknown> = {
    org_id: orgId,
    email: normalizedEmail,
    updated_at: now,
    custom_fields
  };

  const setIfValue = (key: string, value: unknown) => {
    if (value !== null && value !== undefined && value !== "") {
      payload[key] = value;
    }
  };

  setIfValue("name", sheet.name);
  if (phone) payload.phone = phone;
  setIfValue("utm_source", sheet.utm_source);
  setIfValue("utm_medium", sheet.utm_medium);
  setIfValue("utm_campaign", sheet.utm_campaign);
  setIfValue("utm_content", sheet.utm_content);
  setIfValue("utm_term", sheet.utm_term);
  setIfValue("lead_source", sheet.lead_source);
  setIfValue("ad_set_id", sheet.ad_set_id);
  setIfValue("ghl_contact_id", sheet.ghl_contact_id);

  // Preserve first form_filled_at; set on insert when provided.
  const formFilledAt = existing?.form_filled_at ?? sheet.form_filled_at ?? null;
  if (formFilledAt) payload.form_filled_at = formFilledAt;

  const { data, error } = await db
    .from("leads")
    .upsert(omitLegacyLeadColumns(payload), { onConflict: "org_id,email" })
    .select(LEAD_FULL_SELECT)
    .single();
  if (error) throw error;

  let lead = asLead(data);
  rememberCustomFieldKeys(lead.org_id, Object.keys(lead.custom_fields ?? {}));
  const action: "created" | "updated" = existing ? "updated" : "created";

  // Fresh insert has no stamped stage/lifecycle yet — recompute without touching sheet data.
  if (!existing) {
    lead = await updateLead(lead, {});
  }

  return { lead, action };
}

/** Sheet-safe patch for an existing lead (e.g. matched by phone, not email). */
export function sheetFieldsForLeadUpdate(
  existing: LeadRow,
  sheet: LeadSheetUpsertFields
): Partial<LeadRow> {
  const phone =
    existing.phone && existing.phone.trim()
      ? existing.phone
      : sheet.phone?.trim()
        ? sheet.phone.trim()
        : undefined;

  const patch: Partial<LeadRow> = {
    custom_fields: mergeCustomFields(
      existing.custom_fields,
      sheet.custom_fields ?? {}
    ),
    form_filled_at: existing.form_filled_at ?? sheet.form_filled_at ?? existing.form_filled_at
  };

  if (sheet.name !== null && sheet.name !== undefined && sheet.name !== "") {
    patch.name = sheet.name;
  }
  if (phone !== undefined) patch.phone = phone;
  if (sheet.utm_source) patch.utm_source = sheet.utm_source;
  if (sheet.utm_medium) patch.utm_medium = sheet.utm_medium;
  if (sheet.utm_campaign) patch.utm_campaign = sheet.utm_campaign;
  if (sheet.utm_content) patch.utm_content = sheet.utm_content;
  if (sheet.utm_term) patch.utm_term = sheet.utm_term;
  if (sheet.lead_source) patch.lead_source = sheet.lead_source;
  if (sheet.ad_set_id) patch.ad_set_id = sheet.ad_set_id;
  if (sheet.ghl_contact_id) patch.ghl_contact_id = sheet.ghl_contact_id;

  return patch;
}

/** Merged row after applying patch: first-set timestamps, then stamp() derivations. */
function buildNextLead(existing: LeadRow, patch: Partial<LeadRow>): LeadRow {
  const now = new Date().toISOString();
  // An explicit *_at in the patch wins (lifecycle actions set/clear them directly).
  const at = (
    key: "qualified_at" | "reminder_sent_at" | "call_showed_at" | "closed_at",
    derived: () => string | null
  ): string | null => (key in patch ? (patch[key] ?? null) : derived());

  return stamp(existing, {
    ...patch,
    qualified_at: at("qualified_at", () =>
      patch.qualified !== undefined
        ? firstSetAt(existing.qualified_at, patch.qualified, now)
        : existing.qualified_at
    ),
    reminder_sent_at: at("reminder_sent_at", () =>
      patch.reminder_sent
        ? firstSetAt(existing.reminder_sent_at, patch.reminder_sent, now)
        : existing.reminder_sent_at
    ),
    call_showed_at: at("call_showed_at", () =>
      patch.call_showed === null
        ? null
        : patch.call_showed !== undefined
          ? firstSetAt(existing.call_showed_at, patch.call_showed, now)
          : existing.call_showed_at
    ),
    closed_at: at("closed_at", () =>
      patch.deal_closed !== undefined
        ? firstSetAt(existing.closed_at, patch.deal_closed, now)
        : existing.closed_at
    )
  });
}

const NEVER_WRITTEN_KEYS = new Set(["id", "org_id", "created_at", "pipeline_stage"]);

/**
 * Columns whose value differs from the row we read. Only these are sent, so a
 * write can't clobber fields another request changed in the meantime.
 */
export function changedLeadColumns(existing: LeadRow, next: LeadRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const before = existing as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(next as unknown as Record<string, unknown>)) {
    if (value === undefined || NEVER_WRITTEN_KEYS.has(key)) continue;
    if (JSON.stringify(value) !== JSON.stringify(before[key] ?? null)) out[key] = value;
  }
  return omitGeneratedLeadColumns(omitLegacyLeadColumns(out));
}

export async function updateLead(existing: LeadRow, patch: Partial<LeadRow>): Promise<LeadRow> {
  const db = requireDb();
  const changes = changedLeadColumns(existing, buildNextLead(existing, patch));
  const { data, error } = await db
    .from("leads")
    .update(changes)
    .eq("id", existing.id)
    .eq("org_id", existing.org_id)
    .select(LEAD_FULL_SELECT)
    .single();
  if (error) throw error;
  return asLead(data);
}

export type LeadActivityInput = {
  type: string;
  outcome?: string | null;
  note?: string | null;
  next_action_at?: string | null;
  created_by?: string | null;
};

/**
 * Lead update + activity rows in one transaction (apply_lead_change, migration 009).
 * Either both land or neither does.
 */
export async function commitLeadChange(
  existing: LeadRow,
  patch: Partial<LeadRow>,
  activities: LeadActivityInput[]
): Promise<LeadRow> {
  const db = requireDb();
  const changes = changedLeadColumns(existing, buildNextLead(existing, patch));
  const { data, error } = await db
    .rpc("apply_lead_change", {
      p_lead_id: existing.id,
      p_org_id: existing.org_id,
      p_patch: changes,
      p_activities: activities.map((a) => ({
        type: a.type,
        outcome: a.outcome ?? null,
        note: a.note ?? null,
        next_action_at: a.next_action_at ?? null,
        created_by: a.created_by ?? null
      }))
    })
    .single();
  if (error) throw error;
  return asLead(data);
}

/**
 * Shared WHERE clause for list + count so badges, totals and rows can't drift.
 * Definitions come from lifecycleDefinitions.
 */
function leadsQuery(
  filters: LeadListFilters,
  select: string,
  opts?: { count: "exact"; head: true }
) {
  const db = requireDb();
  const kpi = filters.kpi ? KPI_DEFINITIONS[filters.kpi] : null;
  const dateField = kpi?.field ?? "created_at";

  let query = db.from("leads").select(select, opts).eq("org_id", filters.orgId);

  if (filters.fromISO) query = query.gte(dateField, istDayStartUtcIso(filters.fromISO));
  if (filters.toISO) query = query.lte(dateField, istDayEndUtcIso(filters.toISO));
  if (kpi) {
    query = query.not(kpi.field, "is", null);
    for (const flag of kpi.requireTrue) query = query.eq(flag, true);
  }

  if (filters.pipelineStages && filters.pipelineStages.length > 0) {
    query = query.in("pipeline_stage", filters.pipelineStages);
  }
  if (filters.dead === "hide") query = query.eq("is_dead", false);
  if (filters.dead === "only") query = query.eq("is_dead", true);
  if (filters.formQualified) {
    query = query.eq("form_qualified", filters.formQualified === "yes");
  }
  if (filters.qualified) query = query.eq("qualified", filters.qualified === "yes");
  if (filters.needsQualification) {
    query = query.not("call_booked_at", "is", null).is("qualified", null);
  }
  if (filters.hideFormUnqualified) {
    query = query.or("form_qualified.is.null,form_qualified.eq.true,qualified.not.is.null");
  }
  if (filters.followUp && filters.followUp.length > 0) {
    const today = todayISTDateString();
    const start = istDayStartUtcIso(today);
    const end = istDayEndUtcIso(today);
    const parts: string[] = [];
    if (filters.followUp.includes("overdue")) parts.push(`next_action_at.lt.${start}`);
    if (filters.followUp.includes("today")) {
      parts.push(`and(next_action_at.gte.${start},next_action_at.lte.${end})`);
    }
    if (filters.followUp.includes("upcoming")) parts.push(`next_action_at.gt.${end}`);
    query = query.or(parts.join(","));
  }

  if (filters.sources && filters.sources.length > 0) {
    query = query.in("lead_source", filters.sources);
  }
  if (filters.search && filters.search.trim()) {
    const raw = filters.search.trim().replace(/[%_,]/g, " ");
    const digits = raw.replace(/\D/g, "");
    const parts = [
      `name.ilike.%${raw}%`,
      `email.ilike.%${raw}%`,
      `phone.ilike.%${raw}%`
    ];
    if (digits.length >= 3 && digits !== raw) {
      parts.push(`phone.ilike.%${digits}%`);
    }
    query = query.or(parts.join(","));
  }
  if (filters.meetingsBookedOnly) {
    query = query
      .not("call_scheduled_for", "is", null)
      .gt("call_scheduled_for", new Date().toISOString());
  }
  return { query, dateField };
}

export async function listLeads(filters: LeadListFilters): Promise<LeadRow[]> {
  if (!supabaseAdmin) return [];
  if (!filters.orgId) throw new Error("listLeads requires orgId");

  let { query, dateField } = leadsQuery(filters, LEAD_LIST_SELECT);
  if (filters.sort === "queue") {
    query = query
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
  } else {
    query = query.order(dateField, { ascending: false });
  }

  if (
    typeof filters.limit === "number" &&
    filters.limit > 0 &&
    Number.isFinite(filters.limit)
  ) {
    const offset =
      typeof filters.offset === "number" && filters.offset > 0
        ? Math.floor(filters.offset)
        : 0;
    const limit = Math.floor(filters.limit);
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(asLead);
}

/** Head-count with the same filters as listLeads (tab badges, totals, Slack). */
export async function countLeads(filters: LeadListFilters): Promise<number> {
  if (!supabaseAdmin) return 0;
  if (!filters.orgId) throw new Error("countLeads requires orgId");
  const { query } = leadsQuery(filters, "id", { count: "exact", head: true });
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
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
  const cached = peekCustomFieldKeysCache(orgId);
  if (cached) return cached;
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
  return putCustomFieldKeysCache(
    orgId,
    Array.from(keys).sort((a, b) => a.localeCompare(b))
  );
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
      .select(LEAD_FULL_SELECT)
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
  orgId: string,
  delayMinutes: number
): Promise<LeadRow[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  const cutoff = new Date(Date.now() - delayMinutes * 60_000).toISOString();
  const { data, error } = await db
    .from("leads")
    .select(LEAD_FULL_SELECT)
    .eq("org_id", orgId)
    .or("form_qualified.eq.true,qualified.eq.true")
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
