import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

/**
 * Look up profiles.is_platform_admin for a user id.
 * Separate from org membership — used for /admin/organizations and /clients-ads.
 */
export async function isPlatformAdminForUserId(
  userId: string
): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.is_platform_admin === true;
}

/** Current session → profiles.is_platform_admin. */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return false;
  return isPlatformAdminForUserId(user.id);
}

/** Server Components / pages: non–platform-admins → home. */
export async function requirePlatformAdmin(): Promise<void> {
  const ok = await isPlatformAdmin();
  if (!ok) redirect("/");
}
