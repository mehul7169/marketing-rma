import Link from "next/link";

/**
 * Prev / page numbers / next — shared by /leads and Work Queue.
 * Builds hrefs from serializable pathname + query (no function props —
 * those cannot cross the Server→Client boundary).
 */
export default function Pagination({
  page,
  total,
  pageSize,
  pathname,
  query = {}
}: {
  page: number;
  total: number;
  pageSize: number;
  /** e.g. "/leads" or "/leads/queue" */
  pathname: string;
  /** Current URL query params excluding `page` (plain string map only). */
  query?: Record<string, string>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1 && total <= pageSize) {
    return (
      <p className="text-xs text-slate-500">
        {total === 0 ? "No results" : `${total} result${total === 1 ? "" : "s"}`}
      </p>
    );
  }

  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const pages = visiblePageNumbers(safePage, totalPages);

  function hrefForPage(p: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== "") params.set(key, value);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label="Pagination"
    >
      <p className="text-xs text-slate-500">
        {from}–{to} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <PaginationLink
          href={hrefForPage(safePage - 1)}
          disabled={safePage <= 1}
          label="Previous"
        />
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`ellipsis-${i}`}
              className="px-1.5 text-xs text-slate-400"
            >
              …
            </span>
          ) : (
            <Link
              key={p}
              href={hrefForPage(p)}
              aria-current={p === safePage ? "page" : undefined}
              className={`min-w-[1.75rem] rounded-sm px-2 py-1 text-center text-xs ${
                p === safePage
                  ? "bg-sky-100 font-medium text-sky-950"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {p}
            </Link>
          )
        )}
        <PaginationLink
          href={hrefForPage(safePage + 1)}
          disabled={safePage >= totalPages}
          label="Next"
        />
      </div>
    </nav>
  );
}

function PaginationLink({
  href,
  disabled,
  label
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="rounded-sm px-2 py-1 text-xs text-slate-300">{label}</span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-sm px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
    >
      {label}
    </Link>
  );
}

function visiblePageNumbers(
  current: number,
  total: number
): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) {
    set.add(2);
    set.add(3);
    set.add(4);
  }
  if (current >= total - 2) {
    set.add(total - 1);
    set.add(total - 2);
    set.add(total - 3);
  }
  const sorted = [...set]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}
