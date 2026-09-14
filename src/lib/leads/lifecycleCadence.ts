import { insertLeadActivity } from "@/lib/db/lead_activities";
import { getLeadById, updateLead } from "@/lib/db/leads";
import {
  callAttemptSummary,
  computeActionStatus,
  nextTouchpointAt,
  type CallAttemptOutcome,
  type ShowOutcome
} from "@/lib/leads/actionStatus";
import type { LeadRow } from "@/lib/leads/types";

export type LogCallAttemptOptions = {
  note?: string | null;
  /** Required when outcome = follow_up_needed */
  followUpAt?: string | null;
  /**
   * Quickform qualifying call: also set call_booked_at + call_confirmed
   * and reset contact_attempts.
   */
  bookAndConfirm?: boolean;
  actor?: string | null;
};

async function loadLead(leadId: string, orgId: string): Promise<LeadRow> {
  const lead = await getLeadById(leadId, orgId);
  if (!lead) throw new Error("Lead not found");
  return lead;
}

function withActionStatus(
  lead: LeadRow,
  patch: Partial<LeadRow>,
  lastOutcome?: CallAttemptOutcome | null
): Partial<LeadRow> {
  const merged: LeadRow = { ...lead, ...patch };
  const action_status = computeActionStatus(
    {
      deal_closed: merged.deal_closed,
      is_dead: Boolean(merged.is_dead),
      next_action_at: merged.next_action_at,
      contact_attempts: merged.contact_attempts ?? 0,
      call_confirmed: merged.call_confirmed,
      call_booked_at: merged.call_booked_at,
      last_action: merged.last_action
    },
    lastOutcome
  );
  return { ...patch, action_status };
}

/**
 * Shared calling-cadence writer — every phone touchpoint goes through here.
 */
export async function logCallAttempt(
  leadId: string,
  orgId: string,
  outcome: CallAttemptOutcome,
  opts: LogCallAttemptOptions = {}
): Promise<LeadRow> {
  const lead = await loadLead(leadId, orgId);
  const now = new Date().toISOString();
  const note = opts.note?.trim() || null;
  const actor = opts.actor ?? null;

  await insertLeadActivity({
    org_id: orgId,
    lead_id: leadId,
    type: "call_attempt",
    outcome,
    note,
    created_by: actor
  });

  const summary = callAttemptSummary(outcome);
  const patch: Partial<LeadRow> = {
    last_action: summary,
    last_action_at: now,
    contact_attempts: (lead.contact_attempts ?? 0) + 1
  };

  if (outcome === "no_answer") {
    const attempts = (lead.contact_attempts ?? 0) + 1;
    patch.contact_attempts = attempts;
    if (attempts >= 3) {
      patch.is_dead = true;
      patch.dead_reason = "no answer after 3 touchpoints";
      patch.next_action_at = null;
    } else {
      patch.next_action_at = nextTouchpointAt(new Date());
      patch.is_dead = false;
    }
  } else if (outcome === "follow_up_needed") {
    if (!opts.followUpAt) {
      throw new Error("followUpAt is required for follow_up_needed");
    }
    patch.next_action_at = opts.followUpAt;
  } else if (outcome === "qualified") {
    patch.qualified = true;
    if (opts.bookAndConfirm) {
      patch.call_booked_at = lead.call_booked_at ?? now;
      patch.call_confirmed = true;
      patch.contact_attempts = 0;
      patch.next_action_at = null;
    }
  } else if (outcome === "not_qualified") {
    patch.qualified = false;
    patch.is_dead = true;
    patch.dead_reason = "confirmed not a fit";
    patch.next_action_at = null;
  } else if (outcome === "confirmed") {
    patch.call_confirmed = true;
    patch.contact_attempts = 0;
    patch.next_action_at = null;
  } else if (outcome === "not_confirmed") {
    patch.is_dead = true;
    patch.dead_reason = "booked but not confirmed qualified";
    patch.next_action_at = null;
  }

  return updateLead(lead, withActionStatus(lead, patch, outcome));
}

/** Log-only WhatsApp nudge (no external API yet). */
export async function sendWhatsAppNudge(
  leadId: string,
  orgId: string,
  opts: { note?: string | null; actor?: string | null } = {}
): Promise<LeadRow> {
  const lead = await loadLead(leadId, orgId);
  const now = new Date().toISOString();
  const note = opts.note?.trim() || null;

  await insertLeadActivity({
    org_id: orgId,
    lead_id: leadId,
    type: "whatsapp_sent",
    outcome: null,
    note,
    created_by: opts.actor ?? null
  });

  const patch: Partial<LeadRow> = {
    last_action: "WhatsApp nudge sent",
    last_action_at: now
  };
  return updateLead(lead, withActionStatus(lead, patch));
}

export async function rescheduleCall(
  leadId: string,
  orgId: string,
  newDateTimeIso: string,
  opts: { note?: string | null; actor?: string | null } = {}
): Promise<LeadRow> {
  const lead = await loadLead(leadId, orgId);
  const now = new Date().toISOString();
  const note = opts.note?.trim() || null;

  await insertLeadActivity({
    org_id: orgId,
    lead_id: leadId,
    type: "reschedule",
    outcome: null,
    note,
    created_by: opts.actor ?? null
  });

  const patch: Partial<LeadRow> = {
    call_scheduled_for: newDateTimeIso,
    call_showed: null,
    call_showed_at: null,
    call_showed_by: null,
    last_action: "Call rescheduled",
    last_action_at: now
  };
  return updateLead(lead, withActionStatus(lead, patch));
}

export async function reviveDeadLead(
  leadId: string,
  orgId: string,
  opts: { note?: string | null; actor?: string | null } = {}
): Promise<LeadRow> {
  const lead = await loadLead(leadId, orgId);
  if (!lead.is_dead) {
    throw new Error("Lead is not dead");
  }
  const now = new Date().toISOString();
  const note = opts.note?.trim() || null;

  await insertLeadActivity({
    org_id: orgId,
    lead_id: leadId,
    type: "revive",
    outcome: null,
    note,
    created_by: opts.actor ?? null
  });

  const patch: Partial<LeadRow> = {
    is_dead: false,
    dead_reason: null,
    contact_attempts: 0,
    next_action_at: null,
    last_action: note ? `Revived — ${note}` : "Revived",
    last_action_at: now,
    action_status: "Untouched"
  };
  // Force Untouched after revive (explicit), still run through stamp for stage.
  return updateLead(lead, patch);
}

export async function addLeadNoteActivity(
  leadId: string,
  orgId: string,
  note: string,
  opts: { actor?: string | null } = {}
): Promise<LeadRow> {
  const lead = await loadLead(leadId, orgId);
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Note is required");
  const now = new Date().toISOString();

  await insertLeadActivity({
    org_id: orgId,
    lead_id: leadId,
    type: "note",
    outcome: null,
    note: trimmed,
    created_by: opts.actor ?? null
  });

  const patch: Partial<LeadRow> = {
    last_action: `Note — ${trimmed.slice(0, 80)}`,
    last_action_at: now
  };
  return updateLead(lead, withActionStatus(lead, patch));
}

export async function logShowOutcome(
  leadId: string,
  orgId: string,
  outcome: ShowOutcome,
  opts: { note?: string | null; actor?: string | null } = {}
): Promise<LeadRow> {
  const lead = await loadLead(leadId, orgId);
  const now = new Date().toISOString();
  const note = opts.note?.trim() || null;
  const actor = opts.actor ?? null;

  await insertLeadActivity({
    org_id: orgId,
    lead_id: leadId,
    type: "show_outcome",
    outcome,
    note,
    created_by: actor
  });

  const showed = outcome === "showed";
  const patch: Partial<LeadRow> = {
    call_showed: showed,
    call_showed_by: actor,
    last_action: showed ? "Call showed" : "Call no-show",
    last_action_at: now
  };
  return updateLead(lead, withActionStatus(lead, patch));
}
