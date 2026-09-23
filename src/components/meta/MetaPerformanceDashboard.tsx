import type {
  MetaAdsTrendPoint,
  MetaCampaignNode
} from "@/lib/db/meta_ads_daily";
import CohortMaturityNote from "@/components/CohortMaturityNote";
import MetaAdsTable from "@/components/meta/MetaAdsTable";
import MetaSummaryCards from "@/components/meta/MetaSummaryCards";
import MetaTrendSection from "@/components/meta/MetaTrendSection";

export type MetaPerformanceMode = "lead-source" | "client";

type MetaTotals = {
  totalSpend: number;
  totalLeads: number;
  blendedCostPerLead: number | null;
  averageCtrPercent: number;
};

/**
 * Shared Meta performance body (summary → trends → campaign hierarchy).
 * Routes keep their own chrome/permissions; this is the duplicated mid-section.
 */
export default function MetaPerformanceDashboard({
  mode,
  totals,
  priorTotals,
  periodDays,
  trend,
  rangeDays,
  campaigns,
  unmatchedLeadCount = 0,
  immature = false,
  presetStorageKey
}: {
  mode: MetaPerformanceMode;
  totals: MetaTotals;
  priorTotals: MetaTotals | null;
  periodDays: number;
  trend: MetaAdsTrendPoint[];
  rangeDays: number;
  campaigns: MetaCampaignNode[];
  unmatchedLeadCount?: number;
  immature?: boolean;
  presetStorageKey?: string;
}) {
  const includeFunnelColumns = mode === "lead-source";

  return (
    <>
      <MetaSummaryCards
        totals={totals}
        priorTotals={priorTotals}
        periodDays={periodDays}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-900">Trends</h2>
        <div className="rounded border border-slate-200 p-4">
          <MetaTrendSection trend={trend} rangeDays={rangeDays} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-900">Campaigns</h2>
        {includeFunnelColumns && immature ? <CohortMaturityNote /> : null}
        <MetaAdsTable
          rows={campaigns}
          unmatchedLeadCount={unmatchedLeadCount}
          includeFunnelColumns={includeFunnelColumns}
          presetStorageKey={
            presetStorageKey ??
            (mode === "client" ? "clients-ads-column-preset" : undefined)
          }
        />
        <div className="text-xs text-slate-500">
          {includeFunnelColumns
            ? "Click a row to expand ad sets, then ads. Sort applies at every level. Funnel columns are cohort-based (leads created in this range, matched by utm_content → ad id, then ad name)."
            : "Click a row to expand ad sets, then ads. Sort applies at every level. Client accounts have no lead funnel columns."}
        </div>
      </section>
    </>
  );
}
