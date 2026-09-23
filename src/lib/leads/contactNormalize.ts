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

/**
 * Phone-only leads (Quickform ingest or manual Create Lead) get a placeholder
 * email — not a real address. (org_id, email) is unique and email is NOT NULL.
 */
export function isSyntheticQuickformEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return /@(quickform|manual)\.invalid$/i.test(email.trim());
}

export function manualPlaceholderEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "") || "unknown";
  return `manual-phone-${digits}@manual.invalid`;
}

/** Display label for lead email cells (suppress synthetic placeholders). */
export function displayLeadEmail(email: string | null | undefined): string {
  if (!email || !email.trim()) return "—";
  if (isSyntheticQuickformEmail(email)) return "No email";
  return email;
}
