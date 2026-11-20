import { requireWritableOrgId } from "@/lib/auth/getCurrentOrgId";
import { commitLeadChange, getLeadById } from "@/lib/db/leads";
import { listMembershipsForOrg } from "@/lib/db/memberships";
import {
  DEAL_ERRORS,
  planDeal,
  type DealAction,
  type DealPayload
} from "@/lib/deals/dealLifecycle";
import type { LifecycleActor } from "@/lib/leads/lifecycle";
import type { LeadRow } from "@/lib/leads/types";

export type DealResult = { ok: true; lead: LeadRow } | { ok: false; error: string };

/**
 * Single write path for deal actions: org check → validate → apply_lead_change.
 * Org-preview is read-only via requireWritableOrgId. No overrides.
 */
export async function updateDeal(
  leadId: string,
  action: DealAction,
  payload: DealPayload,
  actor: LifecycleActor
): Promise<DealResult> {
  const orgId = await requireWritableOrgId();
  const lead = await getLeadById(leadId, orgId);
  if (!lead) return { ok: false, error: "Lead not found" };
  return applyDeal(lead, action, payload, actor);
}

/** Same path for callers that already resolved the org and lead (live checks). */
export async function applyDeal(
  lead: LeadRow,
  action: DealAction,
  payload: DealPayload,
  actor: LifecycleActor,
  opts: { now?: string } = {}
): Promise<DealResult> {
  const plan = planDeal(lead, action, payload, actor, opts);
  if (!plan.ok) return plan;
  if (action === "assign_owner" && payload.ownerId) {
    const members = await listMembershipsForOrg(lead.org_id);
    const ok = members.some((m) => m.user_id === payload.ownerId && m.status === "active");
    if (!ok) return { ok: false, error: DEAL_ERRORS.ownerNotMember };
  }
  const updated = await commitLeadChange(
    lead,
    plan.patch,
    plan.activities.map((a) => ({ ...a, created_by: actor.userId }))
  );
  return { ok: true, lead: updated };
}
