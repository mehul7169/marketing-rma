"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, actorEmailFromSession } from "@/lib/auth/session";
import { getLeadById, updateLead } from "@/lib/db/leads";

export type LeadActionInput = {
  qualified?: boolean | null;
  setter_verified?: boolean | null;
  reminder_sent?: boolean | null;
  call_showed?: boolean | null;
  deal_closed?: boolean | null;
  deal_value?: number | null;
  notes?: string | null;
};

function actor(): string {
  return actorEmailFromSession(cookies().get(SESSION_COOKIE)?.value);
}

export async function saveLeadActions(id: string, input: LeadActionInput) {
  const existing = await getLeadById(id);
  if (!existing) throw new Error("Lead not found");

  const by = actor();
  const patch: Parameters<typeof updateLead>[1] = {};

  if (input.qualified !== undefined) {
    patch.qualified = input.qualified;
    if (input.qualified !== null) patch.qualified_by = by;
  }
  if (input.setter_verified !== undefined) {
    patch.setter_verified = input.setter_verified;
    if (input.setter_verified) patch.setter_verified_by = by;
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

  const updated = await updateLead(existing, patch);
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
  return { id: updated.id, stage: updated.stage };
}
