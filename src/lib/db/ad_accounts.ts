import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

export type AdAccountRow = {
  id: string;
  meta_ad_account_id: string;
  client_name: string;
  is_lead_source: boolean;
  active: boolean;
  created_at: string;
};

function requireDb() {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  return supabaseAdmin;
}

function asAdAccount(row: unknown): AdAccountRow {
  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    meta_ad_account_id: String(r.meta_ad_account_id ?? ""),
    client_name: String(r.client_name ?? ""),
    is_lead_source: Boolean(r.is_lead_source),
    active: r.active === false ? false : true,
    created_at: String(r.created_at ?? "")
  };
}

/** Always store/query with `act_` prefix. */
export function normalizeMetaAdAccountId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Meta ad account ID is required");
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

export function metaAdAccountIdVariants(raw: string): string[] {
  const withAct = normalizeMetaAdAccountId(raw);
  const bare = withAct.slice("act_".length);
  return bare ? [withAct, bare] : [withAct];
}

/** All active ad accounts (RMA + clients), ordered lead-source first then name. */
export async function listActiveAdAccounts(): Promise<AdAccountRow[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  const { data, error } = await db
    .from("ad_accounts")
    .select("*")
    .eq("active", true)
    .order("is_lead_source", { ascending: false })
    .order("client_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(asAdAccount);
}

export async function getAdAccountById(id: string): Promise<AdAccountRow | null> {
  if (!supabaseAdmin) return null;
  const db = requireDb();
  const { data, error } = await db
    .from("ad_accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? asAdAccount(data) : null;
}

/** Match either `act_123` or `123` storage forms. */
export async function getAdAccountByMetaId(
  metaAdAccountId: string
): Promise<AdAccountRow | null> {
  if (!supabaseAdmin) return null;
  const db = requireDb();
  const variants = metaAdAccountIdVariants(metaAdAccountId);
  const { data, error } = await db
    .from("ad_accounts")
    .select("*")
    .in("meta_ad_account_id", variants)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? asAdAccount(data) : null;
}

export async function insertAdAccount(input: {
  meta_ad_account_id: string;
  client_name: string;
  is_lead_source?: boolean;
  active?: boolean;
}): Promise<AdAccountRow> {
  const db = requireDb();
  const { data, error } = await db
    .from("ad_accounts")
    .insert({
      meta_ad_account_id: normalizeMetaAdAccountId(input.meta_ad_account_id),
      client_name:
        input.client_name.trim() || normalizeMetaAdAccountId(input.meta_ad_account_id),
      is_lead_source: input.is_lead_source ?? false,
      active: input.active ?? true
    })
    .select("*")
    .single();
  if (error) throw error;
  return asAdAccount(data);
}

export async function updateAdAccountClientName(
  id: string,
  clientName: string
): Promise<AdAccountRow> {
  const db = requireDb();
  const name = clientName.trim();
  if (!name) throw new Error("Client name is required");
  const { data, error } = await db
    .from("ad_accounts")
    .update({ client_name: name })
    .eq("id", id)
    .eq("is_lead_source", false)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Client ad account not found");
  return asAdAccount(data);
}

/**
 * Hard-delete a client ad_accounts row. Parks meta_ads_daily history under the
 * stable Meta act_… id (rows are not deleted) so a later re-add can reclaim them.
 */
export async function deleteClientAdAccount(id: string): Promise<{
  meta_ad_account_id: string;
  client_name: string;
}> {
  const db = requireDb();
  const account = await getAdAccountById(id);
  if (!account || account.is_lead_source) {
    throw new Error("Client ad account not found");
  }

  // Dynamic import avoids a circular dependency with meta_ads_daily ↔ ad_accounts.
  const { remappingMetaAdsDailyAccountId } = await import(
    "@/lib/db/meta_ads_daily"
  );
  const metaId = normalizeMetaAdAccountId(account.meta_ad_account_id);
  await remappingMetaAdsDailyAccountId(account.id, metaId);

  const { error } = await db.from("ad_accounts").delete().eq("id", id);
  if (error) throw error;

  return {
    meta_ad_account_id: metaId,
    client_name: account.client_name
  };
}

/** Client accounts only — excludes RMA lead-source rows (those stay on /meta-ads). */
export async function listClientAdAccounts(): Promise<AdAccountRow[]> {
  if (!supabaseAdmin) return [];
  const db = requireDb();
  const { data, error } = await db
    .from("ad_accounts")
    .select("*")
    .eq("active", true)
    .eq("is_lead_source", false)
    .order("client_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(asAdAccount);
}

/** RMA's own account — used to keep /meta-ads and lead-attribution reads scoped. */
export async function getLeadSourceAdAccount(): Promise<AdAccountRow | null> {
  if (!supabaseAdmin) return null;
  const db = requireDb();
  const { data, error } = await db
    .from("ad_accounts")
    .select("*")
    .eq("is_lead_source", true)
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []).map(asAdAccount);
  if (rows.length === 0) return null;
  // Prefer the normalized act_… form when duplicates exist (legacy bare ids).
  const withAct = rows.find((r) => r.meta_ad_account_id.startsWith("act_"));
  return withAct ?? rows[0]!;
}
