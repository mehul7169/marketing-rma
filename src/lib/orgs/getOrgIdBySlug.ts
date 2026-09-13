import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

/**
 * Resolve an organization id by slug (e.g. website ingest / cron paths with
 * no logged-in user).
 */
export async function getOrgIdBySlug(slug: string): Promise<string> {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new Error(`Organization not found for slug="${slug}"`);
  }
  return String(data.id);
}
