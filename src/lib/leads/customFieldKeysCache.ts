/**
 * In-memory cache of distinct custom_fields keys per org.
 * List loads used to page every lead; ingest / field-edit refresh the keys.
 */

const TTL_MS = 5 * 60 * 1000;

type Entry = { keys: string[]; expires: number };

const cache = new Map<string, Entry>();

export function customFieldKeysCacheTtlMs(): number {
  return TTL_MS;
}

export function invalidateCustomFieldKeysCache(orgId?: string): void {
  if (orgId) cache.delete(orgId);
  else cache.clear();
}

export function peekCustomFieldKeysCache(orgId: string): string[] | null {
  const hit = cache.get(orgId);
  if (!hit || hit.expires <= Date.now()) return null;
  return hit.keys;
}

export function putCustomFieldKeysCache(orgId: string, keys: string[]): string[] {
  const sorted = Array.from(new Set(keys.filter((k) => k.trim()))).sort((a, b) =>
    a.localeCompare(b)
  );
  cache.set(orgId, { keys: sorted, expires: Date.now() + TTL_MS });
  return sorted;
}

/** Merge newly seen keys into a warm cache so the next list load doesn't scan. */
export function rememberCustomFieldKeys(orgId: string, extra: string[]): void {
  if (!orgId || extra.length === 0) return;
  const hit = cache.get(orgId);
  if (!hit || hit.expires <= Date.now()) return;
  const set = new Set(hit.keys);
  let changed = false;
  for (const key of extra) {
    const trimmed = key.trim();
    if (!trimmed || set.has(trimmed)) continue;
    set.add(trimmed);
    changed = true;
  }
  if (changed) {
    cache.set(orgId, {
      keys: Array.from(set).sort((a, b) => a.localeCompare(b)),
      expires: hit.expires
    });
  }
}
