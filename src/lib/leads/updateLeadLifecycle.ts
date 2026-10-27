import { requireWritableOrgId } from "@/lib/auth/getCurrentOrgId";
import { commitLeadChange, getLeadById } from "@/lib/db/leads";
import {
  planLifecycle,
  type LifecycleAction,
  type LifecycleActor,
  type LifecyclePayload,
  type LifecycleSource
} from "@/lib/leads/lifecycle";
import type { LeadRow } from "@/lib/leads/types";

export type LifecycleResult = { ok: true; lead: LeadRow } | { ok: false; error: string };

/**
 * The single write path for lead lifecycle changes from the app:
 * org check → validate → update lead + insert activity (one transaction).
 */
export async function updateLeadLifecycle(
  leadId: string,
  action: LifecycleAction,
  payload: LifecyclePayload,
  actor: LifecycleActor
): Promise<LifecycleResult> {
  const orgId = await requireWritableOrgId();
  const lead = await getLeadById(leadId, orgId);
  if (!lead) return { ok: false, error: "Lead not found" };
  return applyLeadLifecycle(lead, action, payload, actor);
}

/** Same path for callers that already resolved the org and lead (ingestion). */
export async function applyLeadLifecycle(
  lead: LeadRow,
  action: LifecycleAction,
  payload: LifecyclePayload,
  actor: LifecycleActor,
  opts: { source?: LifecycleSource } = {}
): Promise<LifecycleResult> {
  const plan = planLifecycle(lead, action, payload, actor, { source: opts.source });
  if (!plan.ok) return plan;
  const updated = await commitLeadChange(
    lead,
    plan.patch,
    plan.activities.map((a) => ({ ...a, created_by: actor.userId }))
  );
  return { ok: true, lead: updated };
}

/** Plain field edits allowed outside the lifecycle (Work Queue inline cells, notes). */
export type LeadFieldsPatch = {
  name?: string | null;
  phone?: string | null;
  email?: string;
  notes?: string | null;
  deal_value?: number | null;
  /** Shallow-merged into existing custom_fields. */
  custom_fields?: Record<string, unknown>;
};

/** Field edits, logged as one field_edited activity listing the changed keys. */
export async function updateLeadFields(
  leadId: string,
  input: LeadFieldsPatch,
  actor: LifecycleActor
): Promise<LifecycleResult> {
  const orgId = await requireWritableOrgId();
  const lead = await getLeadById(leadId, orgId);
  if (!lead) return { ok: false, error: "Lead not found" };

  const patch: Partial<LeadRow> = {};
  if (input.name !== undefined) patch.name = input.name?.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.email !== undefined) {
    const email = input.email.trim();
    if (!email) return { ok: false, error: "Email is required" };
    patch.email = email;
  }
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.deal_value !== undefined) patch.deal_value = input.deal_value;
  if (input.custom_fields !== undefined) {
    patch.custom_fields = { ...(lead.custom_fields ?? {}), ...input.custom_fields };
  }

  const before = lead as unknown as Record<string, unknown>;
  const changed = Object.keys(patch).filter((key) => {
    const value = (patch as Record<string, unknown>)[key];
    return JSON.stringify(value) !== JSON.stringify(before[key] ?? null);
  });
  if (changed.length === 0) return { ok: true, lead };

  const customKeys =
    "custom_fields" in patch && changed.includes("custom_fields")
      ? Object.keys(input.custom_fields ?? {}).map((k) => `custom_fields.${k}`)
      : [];
  const keys = [...changed.filter((k) => k !== "custom_fields"), ...customKeys];

  const updated = await commitLeadChange(lead, patch, [
    { type: "field_edited", outcome: null, note: keys.join(", "), created_by: actor.userId }
  ]);
  return { ok: true, lead: updated };
}
