/** Fixed page size for lead list tables (/leads, Work Queue). */
export const LEAD_LIST_PAGE_SIZE = 50;

export function parsePageParam(raw: string | undefined | null): number {
  const n = Number.parseInt(String(raw ?? "1"), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function pageOffset(page: number, pageSize = LEAD_LIST_PAGE_SIZE): number {
  return (Math.max(1, page) - 1) * pageSize;
}

export function totalPages(total: number, pageSize = LEAD_LIST_PAGE_SIZE): number {
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}
