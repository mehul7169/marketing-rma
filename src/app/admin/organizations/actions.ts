"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { isRole, type Role } from "@/lib/auth/session";
import { inviteMember } from "@/lib/db/memberships";
import { createOrganization } from "@/lib/db/organizations";
import { formatOrgSlug } from "@/lib/orgs/formatOrgSlug";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createOrganizationAction(
  name: string,
  slug: string
): Promise<ActionResult> {
  await requirePlatformAdmin();
  try {
    const org = await createOrganization({
      name,
      slug: formatOrgSlug(slug)
    });
    revalidatePath("/admin/organizations");
    return { ok: true, id: org.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function inviteMemberAction(
  orgId: string,
  email: string,
  role: string
): Promise<ActionResult> {
  await requirePlatformAdmin();
  if (!isRole(role)) {
    return { ok: false, error: "Role must be admin or viewer" };
  }
  try {
    const member = await inviteMember({
      orgId,
      email,
      role: role as Role
    });
    revalidatePath(`/admin/organizations/${orgId}`);
    revalidatePath("/admin/organizations");
    return { ok: true, id: member.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "already invited" || /duplicate|unique/i.test(msg)) {
      return { ok: false, error: "This email is already invited to this organization" };
    }
    return { ok: false, error: msg };
  }
}
