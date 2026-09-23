/**
 * Shared phone / email normalization for ingest + UI.
 */

/** Strip a literal leading `p:` prefix (Quickform sheet artifact). */
export function normalizePhoneInput(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.replace(/^p:/i, "");
}

/** Phone-only Quickform leads get a placeholder email — not a real address. */
export function isSyntheticQuickformEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return /@quickform\.invalid$/i.test(email.trim());
}

/** Display label for lead email cells (suppress synthetic placeholders). */
export function displayLeadEmail(email: string | null | undefined): string {
  if (!email || !email.trim()) return "—";
  if (isSyntheticQuickformEmail(email)) return "No email";
  return email;
}
