import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

/**
 * Resolve the current user's org from memberships (first membership if several).
 * Returns null when there is no session or no membership — never invents an org.
 */
export async function resolveCurrentOrgId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !data?.org_id) return null;
  return String(data.org_id);
}

/**
 * For Server Components / pages: redirect to login if unauthenticated or
 * not a member of any org. Never fall through to unscoped data.
 */
export async function getCurrentOrgId(): Promise<string> {
  const orgId = await resolveCurrentOrgId();
  if (!orgId) redirect("/login");
  return orgId;
}

/**
 * For Route Handlers / server actions that return JSON or throw:
 * Unauthorized instead of an HTML redirect.
 */
export async function requireOrgId(): Promise<string> {
  const orgId = await resolveCurrentOrgId();
  if (!orgId) throw new Error("Unauthorized");
  return orgId;
}
