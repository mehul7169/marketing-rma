/** Deep-link a lead drawer without wiping the current page's filters. */
export function withLeadParam(
  pathname: string,
  search: string,
  leadId: string | null
): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (leadId) params.set("lead", leadId);
  else params.delete("lead");
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function slackLeadUrl(leadId: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}?lead=${encodeURIComponent(leadId)}`;
}
