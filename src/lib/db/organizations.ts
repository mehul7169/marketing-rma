import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { formatOrgSlug } from "@/lib/orgs/formatOrgSlug";

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type OrganizationListItem = OrganizationRow & {
  member_count: number;
};

function requireDb() {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  return supabaseAdmin;
}

function asOrg(row: Record<string, unknown>): OrganizationRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    created_at: String(row.created_at ?? "")
  };
}

export async function listOrganizations(): Promise<OrganizationListItem[]> {
  const db = requireDb();
  const { data: orgs, error } = await db
    .from("organizations")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const list = (orgs ?? []).map((r) => asOrg(r as Record<string, unknown>));
  if (list.length === 0) return [];

  const { data: memberships, error: memError } = await db
    .from("memberships")
    .select("org_id")
    .in(
      "org_id",
      list.map((o) => o.id)
    );
  if (memError) throw memError;

  const counts = new Map<string, number>();
  for (const row of memberships ?? []) {
    const orgId = String((row as { org_id: string }).org_id);
    counts.set(orgId, (counts.get(orgId) ?? 0) + 1);
  }

  return list.map((o) => ({
    ...o,
    member_count: counts.get(o.id) ?? 0
  }));
}

export async function getOrganizationById(
  id: string
): Promise<OrganizationRow | null> {
  const db = requireDb();
  const { data, error } = await db
    .from("organizations")
    .select("id, name, slug, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? asOrg(data as Record<string, unknown>) : null;
}

export async function createOrganization(input: {
  name: string;
  slug: string;
}): Promise<OrganizationRow> {
  const db = requireDb();
  const name = input.name.trim();
  const slug = formatOrgSlug(input.slug);
  if (!name) throw new Error("Name is required");
  if (!slug) throw new Error("Slug is required");

  const { data, error } = await db
    .from("organizations")
    .insert({ name, slug })
    .select("id, name, slug, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("An organization with this slug already exists");
    }
    throw error;
  }
  return asOrg(data as Record<string, unknown>);
}
