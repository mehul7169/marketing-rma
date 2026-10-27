"use server";

import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import {
  listLeadActivities,
  type LeadActivityRow
} from "@/lib/db/lead_activities";
import { listRemindersForLead } from "@/lib/db/lead_reminders";
import { getLeadById } from "@/lib/db/leads";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import type { LeadReminder, LeadRow } from "@/lib/leads/types";

export type LeadDrawerPayload = {
  lead: LeadRow;
  activities: Array<LeadActivityRow & { actor_email: string | null }>;
  reminders: LeadReminder[];
};

async function emailsByProfileId(
  ids: string[]
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0 || !supabaseAdmin) return {};
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email")
    .in("id", unique);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const r = row as { id: string; email: string | null };
    if (r.email) out[r.id] = r.email;
  }
  return out;
}

export async function loadLeadDrawer(
  leadId: string
): Promise<{ ok: true; data: LeadDrawerPayload } | { ok: false; error: string }> {
  try {
    const orgId = await getCurrentOrgId();
    const [lead, activities, reminders] = await Promise.all([
      getLeadById(leadId, orgId),
      listLeadActivities(leadId, orgId, { limit: 80 }),
      listRemindersForLead(leadId, orgId)
    ]);
    if (!lead) return { ok: false, error: "Lead not found" };
    const emails = await emailsByProfileId(
      activities.map((a) => a.created_by ?? "")
    );
    return {
      ok: true,
      data: {
        lead,
        activities: activities.map((a) => ({
          ...a,
          actor_email: a.created_by ? emails[a.created_by] ?? null : null
        })),
        reminders
      }
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load lead" };
  }
}
