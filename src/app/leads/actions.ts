"use server";

import { revalidatePath } from "next/cache";
import { requireWritableOrgId } from "@/lib/auth/getCurrentOrgId";
import { getActorEmail, getActorUserId } from "@/lib/auth/session";
import { insertLeadReminder, resolveLeadReminder } from "@/lib/db/lead_reminders";
import { getLeadById, scheduleLeadCall, updateLead } from "@/lib/db/leads";
import type { CallAttemptOutcome, ShowOutcome } from "@/lib/leads/actionStatus";
import type { PostCallStatus, RequalificationResult } from "@/lib/leads/computeStage";
import {
  addLeadNoteActivity,
  logCallAttempt,
  logShowOutcome,
  rescheduleCall,
  reviveDeadLead,
  sendWhatsAppNudge
} from "@/lib/leads/lifecycleCadence";
import type { VerificationCallStatus } from "@/lib/leads/types";
import { fromDatetimeLocalIST } from "@/lib/timezone";

export type LeadActionInput = {
  qualified?: boolean | null;
  setter_verified?: boolean | null;
  reminder_sent?: boolean | null;
  call_showed?: boolean | null;
  deal_closed?: boolean | null;
  deal_value?: number | null;
  notes?: string | null;
  recording_url?: string | null;
  requalification_result?: RequalificationResult;
  requalification_notes?: string | null;
  post_call_status?: PostCallStatus | null;
};

const VERIFICATION_ATTEMPT_STATUSES: VerificationCallStatus[] = [
  "no_answer",
  "follow_up_needed",
  "reached"
];

const CALL_OUTCOMES: CallAttemptOutcome[] = [
  "no_answer",
  "follow_up_needed",
  "qualified",
  "not_qualified",
  "confirmed",
  "not_confirmed"
];

/** UUID for lead_activities.created_by / lead_reminders.created_by / cadence actor. */
async function actorId(): Promise<string> {
  return getActorUserId();
}

/** Email for legacy text *_by columns on leads (not UUID FKs). */
async function actorEmail(): Promise<string> {
  return getActorEmail();
}

function revalidateLead(id: string) {
  revalidatePath("/leads");
  revalidatePath("/leads/queue");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
}

export async function saveLeadActions(id: string, input: LeadActionInput) {
  const orgId = await requireWritableOrgId();
  const existing = await getLeadById(id, orgId);
  if (!existing) throw new Error("Lead not found");

  const by = await actorEmail();
  const now = new Date().toISOString();
  const patch: Parameters<typeof updateLead>[1] = {};

  if (input.qualified !== undefined) {
    patch.qualified = input.qualified;
    if (input.qualified !== null) patch.qualified_by = by;
  }
  if (input.setter_verified !== undefined) {
    patch.setter_verified = input.setter_verified;
    if (input.setter_verified !== null) patch.setter_verified_by = by;
  }
  if (input.reminder_sent !== undefined) {
    patch.reminder_sent = input.reminder_sent;
  }
  if (input.call_showed !== undefined) {
    patch.call_showed = input.call_showed;
    if (input.call_showed !== null) patch.call_showed_by = by;
  }
  if (input.deal_closed !== undefined) {
    patch.deal_closed = input.deal_closed;
    if (input.deal_closed !== null) patch.closed_by = by;
  }
  if (input.deal_value !== undefined) {
    patch.deal_value = input.deal_value;
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes;
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

  const updated = await updateLead(existing, patch);
  revalidateLead(id);
  return {
    id: updated.id,
    stage: updated.stage,
    lifecycle_status: updated.lifecycle_status,
    action_status: updated.action_status
  };
}

/** Log a verification-call attempt. Does not set setter_verified. */
export async function logVerificationCallAttempt(
  id: string,
  status: Exclude<VerificationCallStatus, "not_contacted">
) {
  if (!VERIFICATION_ATTEMPT_STATUSES.includes(status)) {
    throw new Error("Invalid verification call status");
  }
  const orgId = await requireWritableOrgId();
  const existing = await getLeadById(id, orgId);
  if (!existing) throw new Error("Lead not found");
  if (!existing.call_booked_at) {
    throw new Error("Book a call before logging verification attempts");
  }

  const now = new Date().toISOString();
  const updated = await updateLead(existing, {
    verification_call_status: status,
    verification_call_attempts: (existing.verification_call_attempts ?? 0) + 1,
    last_verification_call_at: now
  });
  revalidateLead(id);
  return {
    id: updated.id,
    verification_call_status: updated.verification_call_status,
    verification_call_attempts: updated.verification_call_attempts,
    last_verification_call_at: updated.last_verification_call_at
  };
}

export async function saveLeadSchedule(id: string, scheduledForLocal: string) {
  const orgId = await requireWritableOrgId();
  const existing = await getLeadById(id, orgId);
  if (!existing) throw new Error("Lead not found");
  const iso = fromDatetimeLocalIST(scheduledForLocal);
  const updated = await scheduleLeadCall(existing, iso, await actorId());
  revalidateLead(id);
  return {
    id: updated.id,
    stage: updated.stage,
    lifecycle_status: updated.lifecycle_status
  };
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

export async function logLeadCallAttemptAction(
  leadId: string,
  outcome: CallAttemptOutcome,
  opts?: {
    note?: string | null;
    followUpAtLocal?: string | null;
    /** Required for qualified — when the call is scheduled. */
    scheduledForLocal?: string | null;
  }
) {
  if (!CALL_OUTCOMES.includes(outcome)) {
    throw new Error("Invalid call outcome");
  }
  const orgId = await requireWritableOrgId();
  const followUpAt =
    opts?.followUpAtLocal && opts.followUpAtLocal.trim()
      ? fromDatetimeLocalIST(opts.followUpAtLocal)
      : null;
  const scheduledFor =
    opts?.scheduledForLocal && opts.scheduledForLocal.trim()
      ? fromDatetimeLocalIST(opts.scheduledForLocal)
      : null;
  if (outcome === "qualified" && !scheduledFor) {
    throw new Error("Call date/time is required when marking Qualified");
  }
  const updated = await logCallAttempt(leadId, orgId, outcome, {
    note: opts?.note,
    followUpAt,
    scheduledFor,
    actor: await actorId()
  });
  revalidateLead(leadId);
  return {
    id: updated.id,
    action_status: updated.action_status,
    is_dead: updated.is_dead,
    contact_attempts: updated.contact_attempts
  };
}

export async function sendLeadWhatsAppNudgeAction(
  leadId: string,
  note?: string | null
) {
  const orgId = await requireWritableOrgId();
  const updated = await sendWhatsAppNudge(leadId, orgId, {
    note,
    actor: await actorId()
  });
  revalidateLead(leadId);
  return { id: updated.id, action_status: updated.action_status };
}

export async function rescheduleLeadCallAction(
  leadId: string,
  newDateTimeLocal: string,
  note?: string | null
) {
  const orgId = await requireWritableOrgId();
  const iso = fromDatetimeLocalIST(newDateTimeLocal);
  const updated = await rescheduleCall(leadId, orgId, iso, {
    note,
    actor: await actorId()
  });
  revalidateLead(leadId);
  return { id: updated.id, call_scheduled_for: updated.call_scheduled_for };
}

export async function reviveDeadLeadAction(
  leadId: string,
  note?: string | null
) {
  const orgId = await requireWritableOrgId();
  const updated = await reviveDeadLead(leadId, orgId, {
    note,
    actor: await actorId()
  });
  revalidateLead(leadId);
  return {
    id: updated.id,
    action_status: updated.action_status,
    is_dead: updated.is_dead,
    contact_attempts: updated.contact_attempts
  };
}

export async function addLeadNoteAction(leadId: string, note: string) {
  const orgId = await requireWritableOrgId();
  const updated = await addLeadNoteActivity(leadId, orgId, note, {
    actor: await actorId()
  });
  revalidateLead(leadId);
  return { id: updated.id, last_action: updated.last_action };
}

export async function logLeadShowOutcomeAction(
  leadId: string,
  outcome: ShowOutcome,
  note?: string | null
) {
  if (outcome !== "showed" && outcome !== "no_show") {
    throw new Error("Invalid show outcome");
  }
  const orgId = await requireWritableOrgId();
  const updated = await logShowOutcome(leadId, orgId, outcome, {
    note,
    actor: await actorId()
  });
  revalidateLead(leadId);
  return { id: updated.id, call_showed: updated.call_showed };
}
