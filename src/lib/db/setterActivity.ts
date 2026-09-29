import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import {
  computeSetterActivity,
  type SetterActivityReport,
  type SetterCallActivity
} from "@/lib/insights/setterActivity";
import { istDayEndUtcIso, istDayStartUtcIso } from "@/lib/timezone";

const PAGE = 1000;

async function listCallAttemptsInRange(
  orgId: string,
  fromISO: string,
  toISO: string
): Promise<SetterCallActivity[]> {
  const db = supabaseAdmin!;
  const rows: SetterCallActivity[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db
      .from("lead_activities")
      .select("lead_id, outcome, created_at, created_by")
      .eq("org_id", orgId)
      .eq("type", "call_attempt")
      .gte("created_at", istDayStartUtcIso(fromISO))
      .lte("created_at", istDayEndUtcIso(toISO))
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as SetterCallActivity[]));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

async function callBookedAtForLeads(
  orgId: string,
  leadIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data, error } = await supabaseAdmin!
      .from("leads")
      .select("id, call_booked_at")
      .eq("org_id", orgId)
      .in("id", leadIds.slice(i, i + 200));
    if (error) throw error;
    for (const r of data ?? []) {
      const row = r as { id: string; call_booked_at: string | null };
      map.set(row.id, row.call_booked_at);
    }
  }
  return map;
}

async function profileEmails(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const { data, error } = await supabaseAdmin!
    .from("profiles")
    .select("id, email")
    .in("id", userIds);
  if (error) throw error;
  for (const p of data ?? []) {
    const row = p as { id: string; email: string | null };
    if (row.email) map.set(row.id, row.email);
  }
  return map;
}

/** Setter call metrics from lead_activities (call_attempt rows) for one org. */
export async function getSetterActivityReport(
  orgId: string,
  fromISO: string,
  toISO: string
): Promise<SetterActivityReport> {
  if (!supabaseAdmin) return computeSetterActivity([], new Map(), new Map());
  const activities = await listCallAttemptsInRange(orgId, fromISO, toISO);
  const qualifiedLeadIds = Array.from(
    new Set(activities.filter((a) => a.outcome === "qualified").map((a) => a.lead_id))
  );
  const userIds = Array.from(
    new Set(activities.map((a) => a.created_by).filter((id): id is string => Boolean(id)))
  );
  const [bookedAt, labels] = await Promise.all([
    callBookedAtForLeads(orgId, qualifiedLeadIds),
    profileEmails(userIds)
  ]);
  return computeSetterActivity(activities, bookedAt, labels);
}
