import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client using the service role key.
// Auth/login is intentionally not implemented yet since this is meant to be
// protected at the network layer (private URL + optional basic auth later).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    : null;

export function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error("Supabase is not configured (missing env vars).");
  }
  return supabaseAdmin;
}

