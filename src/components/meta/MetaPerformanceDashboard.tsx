import type {
  MetaAdsTrendPoint,
  MetaCampaignNode
} from "@/lib/db/meta_ads_daily";
import CohortMaturityNote from "@/components/CohortMaturityNote";
import MetaAdFunnelTable from "@/components/meta/MetaAdFunnelTable";
import MetaAdsTable from "@/components/meta/MetaAdsTable";
import type { AdFunnelCampaignRow } from "@/lib/meta/adFunnelBreakdown";
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
  presetStorageKey,
  funnelBreakdown
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
  /** /meta-ads only — per-ad funnel table rendered above the trend charts. */
  funnelBreakdown?: AdFunnelCampaignRow[];
}) {
  const includeFunnelColumns = mode === "lead-source";

  return (
    <>
      <MetaSummaryCards
        totals={totals}
        priorTotals={priorTotals}
        periodDays={periodDays}
      />

      {funnelBreakdown ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-900">Funnel by ad</h2>
          {immature ? <CohortMaturityNote /> : null}
          <MetaAdFunnelTable rows={funnelBreakdown} />
          <div className="text-xs text-slate-500">
            Landing page ads = attributed leads from lead_source facebook; Quickform
            ads = quickform_fb / quickform_ig. Opt-in, booking, and qualified-call
            columns are landing-page only; qualified showups cover both. Lead counts
            are cohort-based (created in this range); qualified call booked matches
            /leads?cohort=qualified_call_booked. Cost = row adspend ÷ count. — means
            the metric does not apply to that row&apos;s ad type.
          </div>
        </section>
      ) : null}

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
