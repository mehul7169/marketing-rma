"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, actorEmailFromSession } from "@/lib/auth/session";
import { insertLeadReminder, resolveLeadReminder } from "@/lib/db/lead_reminders";
import { getLeadById, scheduleLeadCall, updateLead } from "@/lib/db/leads";
import type { PostCallStatus, RequalificationResult } from "@/lib/leads/computeStage";
import { fromDatetimeLocalIST } from "@/lib/timezone";

export type LeadActionInput = {
  qualified?: boolean | null;
  setter_verified?: boolean | null;
  reminder_sent?: boolean | null;
  call_showed?: boolean | null;
  deal_closed?: boolean | null;
  deal_value?: number | null;
  notes?: string | null;
  requalification_result?: RequalificationResult;
  requalification_notes?: string | null;
  post_call_status?: PostCallStatus | null;
};

function actor(): string {
  return actorEmailFromSession(cookies().get(SESSION_COOKIE)?.value);
}

export async function saveLeadActions(id: string, input: LeadActionInput) {
  const existing = await getLeadById(id);
  if (!existing) throw new Error("Lead not found");

  const by = actor();
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
  if (input.requalification_result !== undefined) {
    patch.requalification_attempted = true;
    patch.requalification_called_at = now;
    patch.requalification_result = input.requalification_result;
    patch.requalification_notes = input.requalification_notes ?? existing.requalification_notes;
  }
  if (input.post_call_status !== undefined) {
    patch.post_call_status = input.post_call_status;
    patch.post_call_status_updated_at = now;
    patch.post_call_status_updated_by = by;
  }

  const updated = await updateLead(existing, patch);
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
  return { id: updated.id, stage: updated.stage, lifecycle_status: updated.lifecycle_status };
}

function revalidateLead(id: string) {
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
}

export async function saveLeadSchedule(id: string, scheduledForLocal: string) {
  const existing = await getLeadById(id);
  if (!existing) throw new Error("Lead not found");
  const iso = fromDatetimeLocalIST(scheduledForLocal);
  const updated = await scheduleLeadCall(existing, iso, actor());
  revalidateLead(id);
  return { id: updated.id, stage: updated.stage, lifecycle_status: updated.lifecycle_status };
}

export async function addLeadFollowUp(
  leadId: string,
  text: string,
  dueAtLocal: string | null
) {
  const existing = await getLeadById(leadId);
  if (!existing) throw new Error("Lead not found");
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Follow-up text is required");
  const due_at = dueAtLocal && dueAtLocal.trim() ? fromDatetimeLocalIST(dueAtLocal) : null;
  await insertLeadReminder({
    lead_id: leadId,
    text: trimmed,
    due_at,
    created_by: actor()
  });
  revalidateLead(leadId);
}

export async function markLeadFollowUpResolved(reminderId: string, leadId: string) {
  await resolveLeadReminder(reminderId);
  revalidateLead(leadId);
}
