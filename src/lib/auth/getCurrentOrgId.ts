import { redirect } from "next/navigation";
import { resolveMembershipOrgId } from "@/lib/auth/cachedAuth";
import {
  ORG_PREVIEW_READ_ONLY_MESSAGE,
  resolveOrgPreview
} from "@/lib/auth/orgPreview";

/**
 * Resolve the effective org for this request.
 *
 * Order:
 * 1. If platform admin + valid preview_org_id cookie → that org (skip membership).
 * 2. Else real membership lookup.
 *
 * Non–platform-admins never take the preview path, even with a forged cookie.
 */
export async function resolveCurrentOrgId(): Promise<string | null> {
  const preview = await resolveOrgPreview();
  if (preview) return preview.orgId;
  return resolveMembershipOrgId();
}

/**
 * For Server Components / pages: redirect to login if unauthenticated or
 * not a member of any org (and not in a valid admin preview). Never fall
 * through to unscoped data.
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

/**
 * Same as requireOrgId, but blocks mutations while an org preview is active
 * (read-only preview — safer for QA across client orgs).
 */
export async function requireWritableOrgId(): Promise<string> {
  const preview = await resolveOrgPreview();
  if (preview) {
    throw new Error(ORG_PREVIEW_READ_ONLY_MESSAGE);
  }
  return requireOrgId();
}
