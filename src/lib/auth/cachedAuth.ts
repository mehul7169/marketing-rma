import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import type { User } from "@supabase/supabase-js";

/** One getUser() per RSC request — shared by layout, pages, and actions. */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
});

/** Membership org for the current user — one lookup per RSC request. */
export const resolveMembershipOrgId = cache(async (): Promise<string | null> => {
  const user = await getAuthUser();
  if (!user || !supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !data?.org_id) return null;
  return String(data.org_id);
});

/** profiles.is_platform_admin for the current user — one lookup per RSC request. */
export const resolvePlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getAuthUser();
  if (!user || !supabaseAdmin) return false;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return false;
  return data.is_platform_admin === true;
});
