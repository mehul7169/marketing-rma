import Link from "next/link";
import { redirect } from "next/navigation";
import {
  clampDateRange,
  defaultFromISO,
  fillTrendDateGaps,
  getPriorPeriod,
  inclusiveDayCount
} from "@/lib/utils/date";
import { todayISTDateString } from "@/lib/timezone";
import {
  countMetaAdsRowsForAccount,
  getMetaAdsHierarchy,
  getMetaAdsTotals,
  getMetaAdsTrend
} from "@/lib/db/meta_ads_daily";
import { getAdAccountById } from "@/lib/db/ad_accounts";
import {
  backfillCronJobName,
  getLatestCronRunForJob
} from "@/lib/db/cron_runs";
import DateRangePicker from "@/components/DateRangePicker";
import MetaAdsTable from "@/components/meta/MetaAdsTable";
import MetaSummaryCards from "@/components/meta/MetaSummaryCards";
import MetaTrendSection from "@/components/meta/MetaTrendSection";
import { ClientBackfillBanner } from "@/components/clients/AddClientAdAccountForm";
import {
  ClientNameEditor,
  DeleteClientAccountButton
} from "@/components/clients/ClientAccountControls";

const PENDING_WINDOW_MS = 3 * 60 * 60 * 1000;

async function resolveBackfillStatus(
  accountId: string,
  createdAt: string
): Promise<"pending" | "complete" | "error" | null> {
  const [cron, rowCount] = await Promise.all([
    getLatestCronRunForJob(backfillCronJobName(accountId)),
    countMetaAdsRowsForAccount(accountId)
  ]);
  if (cron?.status === "error") return "error";
  if (cron?.status === "success" || rowCount > 0) return "complete";
  const created = Date.parse(createdAt);
  if (Number.isFinite(created) && Date.now() - created < PENDING_WINDOW_MS) {
    return "pending";
  }
  return null;
}

export default async function ClientAdsDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { from?: string; to?: string };
}) {
  const account = await getAdAccountById(params.id);
  if (!account || account.is_lead_source || !account.active) {
    redirect("/clients-ads");
  }

  const hasCustomRange = Boolean(searchParams.from || searchParams.to);
  const todayISO = todayISTDateString();
  let fromISO = defaultFromISO(todayISO);
  let toISO = todayISO;

  try {
    if (searchParams.from && searchParams.to) {
      const clamped = clampDateRange(searchParams.from, searchParams.to);
      fromISO = clamped.fromISO;
      toISO = clamped.toISO;
    }
  } catch {
    // Graceful fallback to default range.
  }

  const priorPeriod = getPriorPeriod(fromISO, toISO);
  const rangeDays = inclusiveDayCount(fromISO, toISO);
  const accountId = account.id;

  const initialBackfillStatus = await resolveBackfillStatus(
    accountId,
    account.created_at
  );

  const [totals, priorTotals, trendRaw, hierarchy] = await Promise.all([
    getMetaAdsTotals(fromISO, toISO, accountId),
    getMetaAdsTotals(priorPeriod.fromISO, priorPeriod.toISO, accountId),
    getMetaAdsTrend(fromISO, toISO, accountId),
    getMetaAdsHierarchy(fromISO, toISO, accountId)
  ]);

  const hasAnyData = trendRaw.length > 0 || hierarchy.length > 0;
  const daysWithData = trendRaw.filter((d) => d.spend > 0 || d.leads > 0).length;
  const trendForChart =
    daysWithData >= 3
      ? fillTrendDateGaps(trendRaw, fromISO, toISO, {
          spend: 0,
          leads: 0,
          clicks: 0
        })
      : trendRaw;

  const priorHasData =
    priorTotals.totalSpend > 0 ||
    priorTotals.totalLeads > 0 ||
    priorTotals.averageCtrPercent > 0;

  const isBackfilling = initialBackfillStatus === "pending";

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/clients-ads"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Client Ads
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <ClientNameEditor
            accountId={account.id}
            initialName={account.client_name}
          />
          <div className="space-y-1 text-sm text-slate-600">
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Meta Ad Account ID
              </span>
              <div className="font-mono text-slate-800">
                {account.meta_ad_account_id}
              </div>
              <div className="text-xs text-slate-500">
                Read-only — stable identifier; only the display name can change.
              </div>
            </div>
            <p>
              {fromISO} to {toISO}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <DateRangePicker
            fromISO={fromISO}
            toISO={toISO}
            hasCustomRange={hasCustomRange}
            pathname={`/clients-ads/${account.id}`}
          />
          <DeleteClientAccountButton
            accountId={account.id}
            clientName={account.client_name}
          />
        </div>
      </div>

      <ClientBackfillBanner
        accountId={account.id}
        clientName={account.client_name}
        initialStatus={initialBackfillStatus}
      />

      {isBackfilling && !hasAnyData ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-10 text-center text-sm text-amber-900">
          Backfilling historical data… Campaign metrics will appear here when
          the pull finishes.
        </div>
      ) : !hasAnyData ? (
        <div className="rounded border border-slate-200 p-10 text-center text-sm text-slate-600">
          No data in this date range yet for {account.client_name}.
        </div>
      ) : (
        <>
          <MetaSummaryCards
            totals={totals}
            priorTotals={priorHasData ? priorTotals : null}
            periodDays={priorPeriod.periodDays}
          />

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-900">Trends</h2>
            <div className="rounded border border-slate-200 p-4">
              <MetaTrendSection trend={trendForChart} rangeDays={rangeDays} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-900">Campaigns</h2>
            <MetaAdsTable
              rows={hierarchy}
              includeFunnelColumns={false}
              presetStorageKey="clients-ads-column-preset"
            />
            <div className="text-xs text-slate-500">
              Click a row to expand ad sets, then ads. Sort applies at every
              level. Client accounts have no lead funnel columns.
            </div>
          </section>
        </>
      )}
    </div>
  );
}
