import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import type { Role } from "@/lib/auth/session";
import { isRole } from "@/lib/auth/session";

export type MembershipListItem = {
  id: string;
  org_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: Role;
  /** Display email: profiles.email when linked, else invited_email. */
  email: string;
  status: "active" | "invited";
};

function requireDb() {
  if (!supabaseAdmin) throw new Error("Supabase is not configured.");
  return supabaseAdmin;
}

export async function listMembershipsForOrg(
  orgId: string
): Promise<MembershipListItem[]> {
  const db = requireDb();
  const { data: rows, error } = await db
    .from("memberships")
    .select("id, org_id, user_id, invited_email, role")
    .eq("org_id", orgId)
    .order("invited_email", { ascending: true, nullsFirst: false });
  if (error) throw error;

  const memberships = rows ?? [];
  const userIds = memberships
    .map((r) => (r as { user_id: string | null }).user_id)
    .filter((id): id is string => Boolean(id));

  const emailByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await db
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    if (profileError) throw profileError;
    for (const p of profiles ?? []) {
      const row = p as { id: string; email: string | null };
      if (row.email) emailByUserId.set(row.id, row.email);
    }
  }

  return memberships.map((raw) => {
    const r = raw as {
      id: string;
      org_id: string;
      user_id: string | null;
      invited_email: string | null;
      role: string;
    };
    const role: Role = isRole(r.role) ? r.role : "viewer";
    const active = Boolean(r.user_id);
    const email =
      (active && r.user_id ? emailByUserId.get(r.user_id) : null) ??
      r.invited_email ??
      "—";
    return {
      id: r.id,
      org_id: r.org_id,
      user_id: r.user_id,
      invited_email: r.invited_email,
      role,
      email,
      status: active ? "active" : "invited"
    };
  });
}

export async function inviteMember(input: {
  orgId: string;
  email: string;
  role: Role;
}): Promise<MembershipListItem> {
  const db = requireDb();
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required");
  }
  if (!isRole(input.role)) {
    throw new Error("Role must be admin or viewer");
  }

  const { data, error } = await db
    .from("memberships")
    .insert({
      org_id: input.orgId,
      invited_email: email,
      role: input.role,
      user_id: null
    })
    .select("id, org_id, user_id, invited_email, role")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("already invited");
    }
    throw error;
  }

  const r = data as {
    id: string;
    org_id: string;
    user_id: string | null;
    invited_email: string | null;
    role: string;
  };
  return {
    id: r.id,
    org_id: r.org_id,
    user_id: r.user_id,
    invited_email: r.invited_email,
    role: isRole(r.role) ? r.role : input.role,
    email: r.invited_email ?? email,
    status: r.user_id ? "active" : "invited"
  };
}
