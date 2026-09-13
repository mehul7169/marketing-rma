/**
 * Canonical custom_fields keys for website qualification answers.
 * Always write/read these exact keys (matches historical backfill).
 */
export const WEBSITE_CANONICAL_CUSTOM_FIELD_KEYS = [
  "describes_you",
  "biggest_goal",
  "monthly_revenue",
  "investment_capacity"
] as const;

export type WebsiteCanonicalCustomFieldKey =
  (typeof WEBSITE_CANONICAL_CUSTOM_FIELD_KEYS)[number];

/**
 * Legacy Postgres columns on leads — inert; never read or write from app code.
 * Kept in the DB until a follow-up drop migration.
 */
export const LEGACY_LEAD_COLUMN_KEYS = [
  "describes_you",
  "biggest_goal",
  "monthly_revenue",
  "investment_capacity",
  "form_answers"
] as const;

/** Strip legacy columns from a row before insert/update so they stay untouched. */
export function omitLegacyLeadColumns<T extends Record<string, unknown>>(
  row: T
): T {
  const out: Record<string, unknown> = { ...row };
  for (const key of LEGACY_LEAD_COLUMN_KEYS) {
    delete out[key];
  }
  return out as T;
}

/**
 * Display-only humanization for custom_fields keys.
 * e.g. what_describes_you_best? → "What Describes You Best?"
 */
export function humanizeFieldKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return key;

  const trailingPunct = trimmed.match(/[?!.]+$/)?.[0] ?? "";
  const core = trailingPunct
    ? trimmed.slice(0, trimmed.length - trailingPunct.length)
    : trimmed;

  const words = core
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (!word) return word;
      // Preserve already-capitalized multi-word headers like "Business Description"
      if (/[a-z]/.test(word) && /[A-Z]/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

  return `${words.join(" ")}${trailingPunct}`;
}

/** Drop null/undefined/blank strings so merges don't wipe good values with empties. */
export function compactCustomFields(
  input: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      const t = value.trim();
      if (!t) continue;
      out[key] = t;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** Shallow JSONB-style merge: existing || incoming (incoming wins on key clash). */
export function mergeCustomFields(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    ...compactCustomFields(incoming)
  };
}

export function getCustomFieldString(
  customFields: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  const cf = customFields ?? {};
  for (const key of keys) {
    const v = cf[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v);
  }
  return null;
}
