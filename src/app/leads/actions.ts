"use server";

import { revalidatePath } from "next/cache";
import { requireWritableOrgId } from "@/lib/auth/getCurrentOrgId";
import { getActorEmail, getActorUserId } from "@/lib/auth/session";
import { insertLeadActivity } from "@/lib/db/lead_activities";
import { insertLeadReminder, resolveLeadReminder } from "@/lib/db/lead_reminders";
import {
  commitLeadChange,
  getLeadByEmail,
  getLeadById,
  getLeadByPhone,
  insertLead,
  updateLead
} from "@/lib/db/leads";
import { isSyntheticQuickformEmail } from "@/lib/leads/contactNormalize";
import type { LifecycleAction, LifecycleActor, LifecyclePayload } from "@/lib/leads/lifecycle";
import {
  validateManualLead,
  type ManualLeadFieldErrors,
  type ManualLeadInput
} from "@/lib/leads/manualLead";
import type { PostCallStatus, RequalificationResult } from "@/lib/leads/computeStage";
import {
  updateLeadFields,
  updateLeadLifecycle,
  type LeadFieldsPatch,
  type LifecycleResult
} from "@/lib/leads/updateLeadLifecycle";
import type { LeadRow } from "@/lib/leads/types";
import { fromDatetimeLocalIST } from "@/lib/timezone";

/** Post-call fields on the detail page. Lifecycle milestones go through leadLifecycleAction. */
export type LeadActionInput = {
  reminder_sent?: boolean | null;
  deal_closed?: boolean | null;
  deal_value?: number | null;
  recording_url?: string | null;
  requalification_result?: RequalificationResult;
  requalification_notes?: string | null;
  post_call_status?: PostCallStatus | null;
};

/** Work Queue / detail inline edits. call_scheduled_for routes to book/reschedule. */
export type LeadPlainFieldsPatch = LeadFieldsPatch & {
  /** ISO timestamptz — inline edit of Call scheduled. */
  call_scheduled_for?: string | null;
};

/** UUID for lead_activities.created_by / lead_reminders.created_by. */
async function actorId(): Promise<string> {
  return getActorUserId();
}

/** Email for legacy text *_by columns on leads (not UUID FKs). */
async function actorEmail(): Promise<string> {
  return getActorEmail();
}

async function actor(): Promise<LifecycleActor> {
  return { userId: await actorId(), email: await actorEmail() };
}

function revalidateLead(id: string) {
  revalidatePath("/leads");
  revalidatePath("/leads/queue");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
}

/** Thrown server-action messages are masked in production, so return them instead. */
async function asResult(fn: () => Promise<LifecycleResult>): Promise<LifecycleResult> {
  try {
    return await fn();
  } catch (e) {
    console.error("[lead action]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}

/** Every lifecycle milestone from the UI (Work Queue + detail page). */
export async function leadLifecycleAction(
  leadId: string,
  action: LifecycleAction,
  payload: LifecyclePayload = {}
): Promise<LifecycleResult> {
  const result = await asResult(async () =>
    updateLeadLifecycle(leadId, action, payload, await actor())
  );
  if (result.ok) revalidateLead(leadId);
  return result;
}

export async function saveLeadActions(id: string, input: LeadActionInput) {
  const orgId = await requireWritableOrgId();
  const existing = await getLeadById(id, orgId);
  if (!existing) throw new Error("Lead not found");

  const by = await actorEmail();
  const now = new Date().toISOString();
  const patch: Parameters<typeof updateLead>[1] = {};

  if (input.reminder_sent !== undefined) {
    patch.reminder_sent = input.reminder_sent;
  }
  if (input.deal_closed !== undefined) {
    patch.deal_closed = input.deal_closed;
    if (input.deal_closed !== null) patch.closed_by = by;
  }
  if (input.deal_value !== undefined) {
    patch.deal_value = input.deal_value;
  }
  if (input.recording_url !== undefined) {
    const trimmed =
      typeof input.recording_url === "string" ? input.recording_url.trim() : "";
    patch.recording_url = trimmed.length > 0 ? trimmed : null;
  }
  if (input.requalification_result !== undefined) {
    patch.requalification_attempted = true;
    patch.requalification_called_at = now;
    patch.requalification_result = input.requalification_result;
    patch.requalification_notes =
      input.requalification_notes ?? existing.requalification_notes;
  }
  if (input.post_call_status !== undefined) {
    patch.post_call_status = input.post_call_status;
    patch.post_call_status_updated_at = now;
    patch.post_call_status_updated_by = by;
  }

  const won =
    input.deal_closed !== undefined &&
    input.deal_closed !== null &&
    input.deal_closed !== existing.deal_closed
      ? input.deal_closed
      : null;
  let updated: LeadRow;
  if (won !== null) {
    patch.last_action = won ? "Deal won" : "Deal lost";
    patch.last_action_at = now;
    updated = await commitLeadChange(existing, patch, [
      { type: "deal_outcome", outcome: won ? "won" : "lost", created_by: await actorId() }
    ]);
  } else {
    updated = await updateLead(existing, patch);
  }
  revalidateLead(id);
  return {
    id: updated.id,
    stage: updated.stage,
    lifecycle_status: updated.lifecycle_status,
    action_status: updated.action_status
  };
}

/**
 * Inline edits — logged as field_edited. "Call scheduled" is a booking change,
 * so it goes through book_call / reschedule_call instead of a plain write.
 */
export async function saveLeadPlainFieldsAction(
  id: string,
  input: LeadPlainFieldsPatch
): Promise<LifecycleResult> {
  const { call_scheduled_for, ...fields } = input;
  const result = await asResult(async () => {
    const who = await actor();
    if (call_scheduled_for !== undefined) {
      if (!call_scheduled_for) {
        return { ok: false, error: "Use Cancel call on the lead page to clear a booking." };
      }
      const orgId = await requireWritableOrgId();
      const lead = await getLeadById(id, orgId);
      if (!lead) return { ok: false, error: "Lead not found" };
      const res = await updateLeadLifecycle(
        id,
        lead.call_booked_at ? "reschedule_call" : "book_call",
        { scheduledFor: call_scheduled_for },
        who
      );
      if (!res.ok || Object.keys(fields).length === 0) return res;
    }
    return updateLeadFields(id, fields, who);
  });
  if (result.ok) revalidateLead(id);
  return result;
}

export async function addLeadFollowUp(
  leadId: string,
  text: string,
  dueAtLocal: string | null
) {
  const orgId = await requireWritableOrgId();
  const existing = await getLeadById(leadId, orgId);
  if (!existing) throw new Error("Lead not found");
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Follow-up text is required");
  const due_at =
    dueAtLocal && dueAtLocal.trim() ? fromDatetimeLocalIST(dueAtLocal) : null;
  await insertLeadReminder({
    org_id: orgId,
    lead_id: leadId,
    text: trimmed,
    due_at,
    created_by: await actorId()
  });
  revalidateLead(leadId);
}

export async function markLeadFollowUpResolved(
  reminderId: string,
  leadId: string
) {
  const orgId = await requireWritableOrgId();
  await resolveLeadReminder(reminderId, orgId);
  revalidateLead(leadId);
}

export async function addLeadNoteAction(leadId: string, note: string): Promise<LifecycleResult> {
  const result = await asResult(async () => {
    const trimmed = note.trim();
    if (!trimmed) return { ok: false, error: "Note is required" };
    const orgId = await requireWritableOrgId();
    const lead = await getLeadById(leadId, orgId);
    if (!lead) return { ok: false, error: "Lead not found" };
    const updated = await commitLeadChange(
      lead,
      { last_action: `Note — ${trimmed.slice(0, 80)}`, last_action_at: new Date().toISOString() },
      [{ type: "note", note: trimmed, created_by: await actorId() }]
    );
    return { ok: true, lead: updated };
  });
  if (result.ok) revalidateLead(leadId);
  return result;
}

export type CreateManualLeadResult =
  | { ok: true; lead: LeadRow }
  | {
      ok: false;
      error: string;
      fieldErrors?: ManualLeadFieldErrors;
      existingLeadId?: string;
    };

/**
 * Work Queue "Create Lead". Returns a result instead of throwing so the form can
 * show specific messages (thrown server-action errors are masked in production).
 */
export async function createManualLeadAction(
  input: ManualLeadInput
): Promise<CreateManualLeadResult> {
  let orgId: string;
  try {
    orgId = await requireWritableOrgId();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unauthorized" };
  }

  const parsed = validateManualLead(input);
  if (!parsed.ok) {
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors: parsed.errors };
  }
  const { name, phone, email, lead_source, notes } = parsed.lead;

  // Same match keys as ingest: (org_id, email) unique, then phone digits.
  if (!isSyntheticQuickformEmail(email)) {
    const byEmail = await getLeadByEmail(email, orgId);
    if (byEmail) {
      return {
        ok: false,
        error: `A lead with this email already exists${byEmail.name ? ` (${byEmail.name})` : ""}.`,
        fieldErrors: { email: "Already used by another lead in this org." },
        existingLeadId: byEmail.id
      };
    }
  }
  const byPhone = await getLeadByPhone(phone, orgId);
  if (byPhone) {
    return {
      ok: false,
      error: `A lead with this phone number already exists${byPhone.name ? ` (${byPhone.name})` : ""}.`,
      fieldErrors: { phone: "Already used by another lead in this org." },
      existingLeadId: byPhone.id
    };
  }

  const created_by = await actorId();
  let lead: LeadRow;
  try {
    lead = await insertLead({ org_id: orgId, email, name, phone, lead_source, notes });
  } catch (e) {
    if ((e as { code?: string })?.code === "23505") {
      return { ok: false, error: "A lead with this email already exists in this org." };
    }
    console.error("[createManualLeadAction]", e);
    return { ok: false, error: "Could not create the lead. Please try again." };
  }

  // Creator is recorded in the activity log (UUID → profiles), not on leads.
  try {
    await insertLeadActivity({
      org_id: orgId,
      lead_id: lead.id,
      type: "lead_created",
      outcome: lead_source,
      note: "Lead created manually",
      created_by
    });
  } catch (e) {
    // Lead already exists — don't report failure and invite a duplicate retry.
    console.error("[createManualLeadAction] activity log failed", lead.id, e);
  }

  revalidateLead(lead.id);
  return { ok: true, lead };
}
