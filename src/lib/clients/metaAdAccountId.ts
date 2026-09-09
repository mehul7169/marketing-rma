/**
 * UI / API helpers for the "Add Ad Account" numeric field.
 * addClientAccount itself still expects a full act_… id — callers prepend after normalize.
 */

/** Strip whitespace and an optional act_ prefix; return digits-only candidate. */
export function normalizeNumericAdAccountIdInput(raw: string): string {
  let s = raw.trim();
  if (s.toLowerCase().startsWith("act_")) {
    s = s.slice(4).trim();
  }
  return s;
}

/** True when the cleaned value is one or more digits only. */
export function isValidNumericAdAccountIdInput(raw: string): boolean {
  return /^\d+$/.test(normalizeNumericAdAccountIdInput(raw));
}

/** Normalize + prepend act_ for addClientAccount. Throws if not numeric after clean. */
export function toActPrefixedAdAccountId(raw: string): string {
  const digits = normalizeNumericAdAccountIdInput(raw);
  if (!/^\d+$/.test(digits)) {
    throw new Error("Enter just the numeric ID, without act_");
  }
  return `act_${digits}`;
}
