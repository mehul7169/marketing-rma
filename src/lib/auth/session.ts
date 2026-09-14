import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

/** Kept for memberships.role / invite UI — not used for page access. */
export type Role = "admin" | "viewer";

export function isRole(value: string): value is Role {
  return value === "admin" || value === "viewer";
}

/**
 * profiles.role lookup — retained for compatibility / invite tooling.
 * Do not use for route or UI access decisions (use membership + is_platform_admin).
 */
export async function getRoleForUserId(userId: string): Promise<Role | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const role = typeof data.role === "string" ? data.role : "";
  return isRole(role) ? role : "viewer";
}

/** Current Supabase Auth user (null if not signed in). */
export async function getCurrentSession(): Promise<{
  userId: string;
  email: string | null;
} | null> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    userId: user.id,
    email: user.email ?? null
  };
}

/**
 * Auth user id (profiles.id / auth.uid()) for UUID FK columns such as
 * lead_activities.created_by. Throws when unauthenticated — never invents a value.
 */
export async function getActorUserId(): Promise<string> {
  const session = await getCurrentSession();
  if (!session?.userId) throw new Error("Unauthorized");
  return session.userId;
}

/**
 * Email for legacy text audit fields on leads (qualified_by, closed_by, …).
 * Do not use for UUID columns — use getActorUserId instead.
 */
export async function getActorEmail(): Promise<string> {
  const session = await getCurrentSession();
  return session?.email ?? "unknown";
}
