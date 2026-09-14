import { redirect } from "next/navigation";
import { resolveMembershipOrgId } from "@/lib/auth/cachedAuth";

/**
 * Resolve the current user's org from memberships (first membership if several).
 * Returns null when there is no session or no membership — never invents an org.
 */
export async function resolveCurrentOrgId(): Promise<string | null> {
  return resolveMembershipOrgId();
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
