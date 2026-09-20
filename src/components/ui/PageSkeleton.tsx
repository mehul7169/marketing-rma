import type { ReactNode } from "react";
import {
  CardGridSkeleton,
  ChartSkeleton,
  PageHeaderSkeleton,
  SkeletonBlock,
  StatCardsSkeleton,
  TableSkeleton,
  ToolbarSkeleton
} from "@/components/ui/Skeleton";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading page"
    >
      {children}
    </div>
  );
}

/** /leads — filters + table. */
export function LeadsPageSkeleton() {
  return (
    <Shell>
      <div className="shrink-0 space-y-4">
        <PageHeaderSkeleton />
        <div className="flex flex-wrap gap-2">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="h-8 w-28" />
          <SkeletonBlock className="h-8 w-28" />
          <SkeletonBlock className="h-8 w-24" />
        </div>
      </div>
      <TableSkeleton rows={10} cols={7} />
    </Shell>
  );
}

/** /leads/queue — tabs + table (default view). */
export function WorkQueuePageSkeleton() {
  return (
    <Shell>
      <div className="shrink-0 space-y-3">
        <PageHeaderSkeleton />
        <div className="flex flex-wrap items-center gap-3">
          <SkeletonBlock className="h-7 w-56" />
          <SkeletonBlock className="h-7 w-36" />
        </div>
        <ToolbarSkeleton />
      </div>
      <TableSkeleton rows={8} cols={6} />
    </Shell>
  );
}

/** /meta-ads, /website — date range, stats, chart, table. */
export function AnalyticsPageSkeleton({
  titleWidth = "w-28"
}: {
  titleWidth?: string;
}) {
  return (
    <Shell>
      <div className="shrink-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <SkeletonBlock className={`h-7 ${titleWidth}`} />
            <SkeletonBlock className="h-4 w-64 max-w-full" />
          </div>
          <SkeletonBlock className="h-8 w-52" />
        </div>
        <StatCardsSkeleton count={4} />
      </div>
      <ChartSkeleton />
      <TableSkeleton rows={8} cols={6} />
    </Shell>
  );
}

/** /insights — rates + chart + creative table. */
export function InsightsPageSkeleton() {
  return (
    <Shell>
      <div className="shrink-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageHeaderSkeleton />
          <SkeletonBlock className="h-8 w-52" />
        </div>
        <StatCardsSkeleton count={4} />
      </div>
      <ChartSkeleton className="h-48" />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-40 rounded border border-slate-200" />
        <SkeletonBlock className="h-40 rounded border border-slate-200" />
      </div>
      <TableSkeleton rows={6} cols={5} />
    </Shell>
  );
}

/** Home overview funnel. */
export function OverviewPageSkeleton() {
  return (
    <Shell>
      <div className="shrink-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageHeaderSkeleton />
          <SkeletonBlock className="h-8 w-52" />
        </div>
        <StatCardsSkeleton count={5} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="rounded border border-slate-200 bg-white p-4"
          >
            <SkeletonBlock className="mb-2 h-3 w-16" />
            <SkeletonBlock className="h-8 w-14" />
            <SkeletonBlock className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** /clients-ads admin table. */
export function ClientsAdsPageSkeleton() {
  return (
    <Shell>
      <div className="shrink-0 space-y-4">
        <PageHeaderSkeleton />
        <SkeletonBlock className="h-24 w-full max-w-xl rounded border border-slate-200" />
      </div>
      <TableSkeleton rows={6} cols={5} />
    </Shell>
  );
}

/** Lead detail. */
export function LeadDetailPageSkeleton() {
  return (
    <Shell>
      <div className="shrink-0 space-y-3">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-8 w-56" />
        <SkeletonBlock className="h-5 w-28 rounded-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded border border-slate-200 bg-white p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex justify-between gap-4">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-3 w-40" />
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded border border-slate-200 bg-white p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonBlock key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
      <CardGridSkeleton count={2} />
    </Shell>
  );
}
