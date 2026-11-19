import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import {
  getTableViewForUser,
  listTableViewsForPage,
  upsertTableViewForUser
} from "@/lib/db/table_views";
import { encodeCustomFilter } from "@/lib/leads/customFilter";
import {
  SEED_LOST_REACTIVATE_ID,
  SEED_SHOWED_AWAITING_ID,
  type NamedLeadFilter
} from "@/lib/leads/namedFilters";
import type { TableViewPageKey } from "@/lib/table-views/registry";

function newId(): string {
  return `nf_${Math.random().toString(36).slice(2, 12)}`;
}

export async function listNamedFiltersForUser(opts: {
  userId: string;
  pageKey: string;
  orgId: string;
}): Promise<NamedLeadFilter[]> {
  const mine = await getTableViewForUser(opts.userId, opts.pageKey);
  const personal = mine?.config.namedFilters?.[opts.orgId] ?? [];
  const allRows = await listTableViewsForPage(opts.pageKey);
  const shared: NamedLeadFilter[] = [];
  const seen = new Set(personal.map((f) => f.id));
  for (const row of allRows) {
    for (const f of row.config.namedFilters?.[opts.orgId] ?? []) {
      if (!f.shared) continue;
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      shared.push(f);
    }
  }
  return [...personal, ...shared].sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveNamedFilter(opts: {
  userId: string;
  pageKey: string;
  orgId: string;
  name: string;
  shared: boolean;
  query: Record<string, string>;
  id?: string;
}): Promise<NamedLeadFilter> {
  const existing = await getTableViewForUser(opts.userId, opts.pageKey);
  const list = [...(existing?.config.namedFilters?.[opts.orgId] ?? [])];
  const now = new Date().toISOString();
  const id = opts.id?.trim() || newId();
  const idx = list.findIndex((f) => f.id === id);
  const prev = idx >= 0 ? list[idx] : null;
  const next: NamedLeadFilter = {
    id,
    name: opts.name.trim().slice(0, 80),
    shared: opts.shared,
    ownerUserId: prev?.ownerUserId ?? opts.userId,
    query: opts.query,
    updatedAt: now
  };
  if (!next.name) throw new Error("Name is required");
  if (idx >= 0) list[idx] = next;
  else list.push(next);

  await upsertTableViewForUser(opts.userId, opts.pageKey, {
    columns: existing?.config.columns ?? [],
    filters: existing?.config.filters,
    namedFilters: { ...existing?.config.namedFilters, [opts.orgId]: list }
  });
  return next;
}

export async function deleteNamedFilter(opts: {
  userId: string;
  pageKey: string;
  orgId: string;
  id: string;
}): Promise<void> {
  const existing = await getTableViewForUser(opts.userId, opts.pageKey);
  const list = (existing?.config.namedFilters?.[opts.orgId] ?? []).filter((f) => f.id !== opts.id);
  await upsertTableViewForUser(opts.userId, opts.pageKey, {
    columns: existing?.config.columns ?? [],
    filters: existing?.config.filters,
    namedFilters: { ...existing?.config.namedFilters, [opts.orgId]: list }
  });
}

export async function findNamedFilterOwner(opts: {
  pageKey: string;
  orgId: string;
  id: string;
}): Promise<{ userId: string; filter: NamedLeadFilter } | null> {
  const rows = await listTableViewsForPage(opts.pageKey);
  for (const row of rows) {
    const hit = row.config.namedFilters?.[opts.orgId]?.find((f) => f.id === opts.id);
    if (hit) return { userId: row.user_id, filter: hit };
  }
  return null;
}

function seedQuery(pageKey: string, cf: string): Record<string, string> {
  if (pageKey === "leads-queue") return { view: "table", cf };
  return { dead: "show", cf };
}

export function rmaSeedFilters(pageKey: string): NamedLeadFilter[] {
  const lostCf = encodeCustomFilter({
    match: "all",
    conditions: [{ id: "c1", field: "deal", op: "is_any", value: ["lost"] }]
  });
  const showedCf = encodeCustomFilter({
    match: "all",
    conditions: [
      { id: "c1", field: "call_showed", op: "is_yes" },
      {
        id: "c2",
        field: "post_call_status",
        op: "is_any",
        value: ["awaiting_lead_response", "contract_shared"]
      }
    ]
  });
  const now = new Date().toISOString();
  return [
    {
      id: SEED_LOST_REACTIVATE_ID,
      name: "Lost — reactivate",
      shared: true,
      ownerUserId: "seed",
      query: seedQuery(pageKey, lostCf ?? ""),
      updatedAt: now
    },
    {
      id: SEED_SHOWED_AWAITING_ID,
      name: "Showed — awaiting response or contract",
      shared: true,
      ownerUserId: "seed",
      query: seedQuery(pageKey, showedCf ?? ""),
      updatedAt: now
    }
  ];
}

/** Idempotent: writes the two RMA example shared filters if they are missing. */
export async function ensureRmaSharedFilters(opts: {
  orgId: string;
  orgSlug: string;
  pageKey: TableViewPageKey;
  adminUserId: string | null;
}): Promise<void> {
  if (opts.orgSlug !== "rma" && opts.orgSlug !== "rma-marketing") return;
  if (!opts.adminUserId || !supabaseAdmin) return;
  const existing = await listNamedFiltersForUser({
    userId: opts.adminUserId,
    pageKey: opts.pageKey,
    orgId: opts.orgId
  });
  const have = new Set(existing.filter((f) => f.shared).map((f) => f.id));
  for (const seed of rmaSeedFilters(opts.pageKey)) {
    if (have.has(seed.id)) continue;
    await saveNamedFilter({
      userId: opts.adminUserId,
      pageKey: opts.pageKey,
      orgId: opts.orgId,
      id: seed.id,
      name: seed.name,
      shared: true,
      query: seed.query
    });
  }
}
