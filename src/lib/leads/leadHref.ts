/** Set or clear a query param without wiping the rest of the page's filters. */
export function withSearchParam(
  pathname: string,
  search: string,
  key: string,
  value: string | null
): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (value) params.set(key, value);
  else params.delete(key);
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

/** Deep-link a lead drawer without wiping the current page's filters. */
export function withLeadParam(
  pathname: string,
  search: string,
  leadId: string | null
): string {
  return withSearchParam(pathname, search, "lead", leadId);
}

/** Deep-link a deal drawer (`/deals?deal=`). */
export function withDealParam(
  pathname: string,
  search: string,
  dealId: string | null
): string {
  return withSearchParam(pathname, search, "deal", dealId);
}

export function slackLeadUrl(leadId: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}?lead=${encodeURIComponent(leadId)}`;
}

const DEALS_APP_BASE = "https://tracking.runmoreads.in";

/** Slack deep-link into the deal drawer. */
export function slackDealUrl(
  leadId: string,
  baseUrl: string = DEALS_APP_BASE
): string {
  const origin = baseUrl.replace(/\/$/, "").replace(/\/deals$/, "");
  return `${origin}/deals?deal=${encodeURIComponent(leadId)}`;
}
