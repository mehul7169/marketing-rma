/** Named + shared saved filters stored in table_views.config.namedFilters[orgId]. */

export type NamedLeadFilter = {
  id: string;
  name: string;
  shared: boolean;
  ownerUserId: string;
  /** URL params for this page (including cf, sort, quick filters). */
  query: Record<string, string>;
  updatedAt: string;
};

export const SEED_LOST_REACTIVATE_ID = "seed-lost-reactivate";
export const SEED_SHOWED_AWAITING_ID = "seed-showed-awaiting";

export function parseNamedLeadFilter(raw: unknown): NamedLeadFilter | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id.trim()) return null;
  if (typeof r.name !== "string" || !r.name.trim()) return null;
  if (typeof r.ownerUserId !== "string" || !r.ownerUserId.trim()) return null;
  if (!r.query || typeof r.query !== "object" || Array.isArray(r.query)) return null;
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.query as Record<string, unknown>)) {
    if (typeof v === "string" && v) query[k] = v;
  }
  return {
    id: r.id.trim(),
    name: r.name.trim().slice(0, 80),
    shared: r.shared === true,
    ownerUserId: r.ownerUserId,
    query,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString()
  };
}

export function parseNamedLeadFilterList(raw: unknown): NamedLeadFilter[] {
  if (!Array.isArray(raw)) return [];
  const out: NamedLeadFilter[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const f = parseNamedLeadFilter(item);
    if (!f || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}
