"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { resolvePlatformAdmin } from "@/lib/auth/cachedAuth";
import {
  PREVIEW_ORG_COOKIE
} from "@/lib/auth/orgPreviewConstants";
import { getOrganizationById } from "@/lib/db/organizations";

const COOKIE_OPTS = {
  path: "/",
  sameSite: "lax" as const,
  // Readable by RSC/server actions; not a secret — still keep out of JS.
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7
};

export async function setOrgPreviewAction(
  orgId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await resolvePlatformAdmin())) {
    return { ok: false, error: "Forbidden" };
  }
  const trimmed = orgId.trim();
  if (!trimmed) {
    return { ok: false, error: "Organization is required" };
  }
  const org = await getOrganizationById(trimmed);
  if (!org) {
    return { ok: false, error: "Organization not found" };
  }

  cookies().set(PREVIEW_ORG_COOKIE, org.id, COOKIE_OPTS);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearOrgPreviewAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await resolvePlatformAdmin())) {
    return { ok: false, error: "Forbidden" };
  }
  cookies().set(PREVIEW_ORG_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
  revalidatePath("/", "layout");
  return { ok: true };
}
