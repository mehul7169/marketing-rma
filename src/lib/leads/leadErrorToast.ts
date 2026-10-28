/** Toast copy for a failed lead write: name first so the row isn't required on screen. */
export function leadErrorToast(
  lead: { name?: string | null; email?: string | null },
  message: string
): string {
  const who = lead.name?.trim() || lead.email?.trim() || "Lead";
  return `${who}: ${message}`;
}
