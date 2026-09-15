import { cookies } from "next/headers";
import { cache } from "react";
import { resolvePlatformAdmin } from "@/lib/auth/cachedAuth";
import {
  PREVIEW_ORG_COOKIE,
  ORG_PREVIEW_READ_ONLY_MESSAGE
} from "@/lib/auth/orgPreviewConstants";
import { getOrganizationById } from "@/lib/db/organizations";

export { PREVIEW_ORG_COOKIE, ORG_PREVIEW_READ_ONLY_MESSAGE };

/**
 * Raw cookie value (any user). Must never be trusted alone — always gate on
 * isPlatformAdmin() server-side before using as an org id.
 */
export function readPreviewOrgCookie(): string | null {
  try {
    const value = cookies().get(PREVIEW_ORG_COOKIE)?.value?.trim();
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Preview org for the current request, or null.
 * Only platform admins can activate preview; non-admins with a forged cookie
 * are ignored. Invalid org ids are treated as inactive.
 */
export const resolveOrgPreview = cache(async (): Promise<{
  orgId: string;
  orgName: string;
} | null> => {
  const cookieOrgId = readPreviewOrgCookie();
  if (!cookieOrgId) return null;

  // Security: never honor the cookie without a live platform-admin check.
  if (!(await resolvePlatformAdmin())) return null;

  const org = await getOrganizationById(cookieOrgId);
  if (!org) return null;

  return { orgId: org.id, orgName: org.name };
});

export async function isOrgPreviewActive(): Promise<boolean> {
  return Boolean(await resolveOrgPreview());
}
