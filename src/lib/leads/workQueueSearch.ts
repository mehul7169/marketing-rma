import type { LeadRow } from "@/lib/leads/types";

/** Normalize for loose matching (case + strip common phone punctuation). */
export function normalizeWorkQueueSearch(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s\-().+]/g, "");
}

/**
 * Narrow Work Queue rows by name, email, or phone.
 * Empty query returns all rows (caller still owns tab + dead/closed scope).
 */
export function filterWorkQueueLeads(
  rows: LeadRow[],
  query: string
): LeadRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;

  const qDigits = normalizeWorkQueueSearch(q);

  return rows.filter((lead) => {
    const name = (lead.name ?? "").toLowerCase();
    const email = (lead.email ?? "").toLowerCase();
    if (name.includes(q) || email.includes(q)) return true;

    if (!qDigits) return false;
    const phone = normalizeWorkQueueSearch(lead.phone ?? "");
    return phone.includes(qDigits);
  });
}
