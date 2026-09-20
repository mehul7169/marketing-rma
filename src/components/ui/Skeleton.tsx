/** Base grey pulse block — compose into layout-shaped skeletons. */
export function SkeletonBlock({
  className = ""
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200/80 ${className}`}
      aria-hidden
    />
  );
}

export function PageHeaderSkeleton({
  withSubtitle = true
}: {
  withSubtitle?: boolean;
}) {
  return (
    <div className="shrink-0 space-y-2">
      <SkeletonBlock className="h-7 w-40" />
      {withSubtitle ? <SkeletonBlock className="h-4 w-72 max-w-full" /> : null}
    </div>
  );
}

/** Row of summary / rate cards. */
export function StatCardsSkeleton({
  count = 4
}: {
  count?: number;
}) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded border border-slate-200 bg-white p-4 shadow-sm"
        >
          <SkeletonBlock className="mb-3 h-3 w-20" />
          <SkeletonBlock className="h-7 w-24" />
          <SkeletonBlock className="mt-2 h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Chart / trend plot placeholder. */
export function ChartSkeleton({
  className = "h-56"
}: {
  className?: string;
}) {
  return (
    <div
      className={`rounded border border-slate-200 bg-white p-4 ${className}`}
      aria-hidden
    >
      <SkeletonBlock className="mb-4 h-4 w-32" />
      <SkeletonBlock className="h-[calc(100%-2rem)] w-full rounded" />
    </div>
  );
}

/** Table with header + body rows. */
export function TableSkeleton({
  rows = 8,
  cols = 6
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div
      className="min-h-0 flex-1 overflow-hidden rounded border border-slate-200 bg-white"
      aria-hidden
    >
      <div className="flex gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonBlock key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex gap-3 px-4 py-3">
            {Array.from({ length: cols }, (_, c) => (
              <SkeletonBlock
                key={c}
                className={`h-3.5 flex-1 ${c === 0 ? "max-w-[140px]" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Card grid (e.g. Work Queue cards mode). */
export function CardGridSkeleton({
  count = 4
}: {
  count?: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-3 w-48" />
            </div>
            <SkeletonBlock className="h-5 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-4/5" />
            <SkeletonBlock className="h-3 w-3/5" />
          </div>
          <div className="mt-4 flex gap-2">
            <SkeletonBlock className="h-7 w-16" />
            <SkeletonBlock className="h-7 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Toolbar: search + view toggles. */
export function ToolbarSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2" aria-hidden>
      <SkeletonBlock className="h-8 w-56 max-w-full" />
      <div className="flex gap-2">
        <SkeletonBlock className="h-8 w-16" />
        <SkeletonBlock className="h-8 w-16" />
        <SkeletonBlock className="h-8 w-24" />
      </div>
    </div>
  );
}
