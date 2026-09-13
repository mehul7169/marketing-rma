import Link from "next/link";
import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import { requirePlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { listClientAdAccounts } from "@/lib/db/ad_accounts";
import {
  backfillCronJobName,
  getLatestCronRunForJob
} from "@/lib/db/cron_runs";
import {
  countMetaAdsRowsForAccount,
  sumLeadsMetaReportedByAccountForDates
} from "@/lib/db/meta_ads_daily";
import { todayISTDateString } from "@/lib/timezone";
import { addDaysISO } from "@/lib/utils/date";
import { formatInteger } from "@/lib/format";
import AddClientAdAccountForm from "@/components/clients/AddClientAdAccountForm";

const PENDING_WINDOW_MS = 3 * 60 * 60 * 1000;

/** Flag when |yesterday − dayBefore| / max(dayBefore, 1) exceeds this. */
const LEAD_SWING_PCT_THRESHOLD = 0.5;
/**
 * Also flag when one day is 0 and the other is at least this many leads
 * (percentage alone misses zero-base swings).
 */
const LEAD_SWING_ZERO_FLOOR = 5;

function isSignificantLeadSwing(yesterday: number, dayBefore: number): boolean {
  if (yesterday === 0 && dayBefore === 0) return false;
  const pct =
    Math.abs(yesterday - dayBefore) / Math.max(dayBefore, 1);
  if (pct > LEAD_SWING_PCT_THRESHOLD) return true;
  const zeroSwing =
    (yesterday === 0 && dayBefore >= LEAD_SWING_ZERO_FLOOR) ||
    (dayBefore === 0 && yesterday >= LEAD_SWING_ZERO_FLOOR);
  return zeroSwing;
}

async function resolveBackfillStatus(
  accountId: string,
  createdAt: string,
  orgId: string
): Promise<"pending" | "complete" | "error" | null> {
  const [cron, rowCount] = await Promise.all([
    getLatestCronRunForJob(backfillCronJobName(accountId)),
    countMetaAdsRowsForAccount(accountId, orgId)
  ]);
  if (cron?.status === "error") return "error";
  if (cron?.status === "success" || rowCount > 0) return "complete";
  const created = Date.parse(createdAt);
  if (Number.isFinite(created) && Date.now() - created < PENDING_WINDOW_MS) {
    return "pending";
  }
  return null;
}

function LeadDayCell({
  value,
  warn
}: {
  value: number;
  warn: boolean;
}) {
  return (
    <td
      className={`px-4 py-3 tabular-nums ${
        warn ? "font-medium text-amber-800" : "text-slate-700"
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {formatInteger(value)}
        {warn ? (
          <span className="text-amber-700" title="Significant day-over-day swing" aria-label="Significant swing">
            ⚠
          </span>
        ) : null}
      </span>
    </td>
  );
}

export default async function ClientsAdsPage() {
  await requirePlatformAdmin();
  const orgId = await getCurrentOrgId();
  const accounts = await listClientAdAccounts(orgId);
  const todayISO = todayISTDateString();
  const yesterdayISO = addDaysISO(todayISO, -1);
  const dayBeforeISO = addDaysISO(todayISO, -2);

  const [statuses, leadsByAccount] = await Promise.all([
    Promise.all(accounts.map((a) => resolveBackfillStatus(a.id, a.created_at, orgId))),
    sumLeadsMetaReportedByAccountForDates(
      accounts.map((a) => a.id),
      [yesterdayISO, dayBeforeISO],
      orgId
    )
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Client Ads</h1>
          <p className="mt-1 text-sm text-slate-600">
            Client Meta ad accounts (RMA&apos;s own account stays on Meta Ads).
            Lead counts are Meta-reported for IST calendar days.
          </p>
        </div>
        <AddClientAdAccountForm />
      </div>

      {accounts.length === 0 ? (
        <div className="rounded border border-slate-200 p-10 text-center text-sm text-slate-600">
          No client ad accounts yet. Use Add Ad Account with the numeric Meta
          account ID your Business Manager can access.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-700">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Meta Ad Account ID</th>
                <th className="px-4 py-3 font-medium">
                  Yesterday
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">
                    {yesterdayISO}
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">
                  Day Before
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">
                    {dayBeforeISO}
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account, i) => {
                const status = statuses[i];
                const byDate = leadsByAccount.get(account.id);
                const yesterday = byDate?.get(yesterdayISO) ?? 0;
                const dayBefore = byDate?.get(dayBeforeISO) ?? 0;
                const warn = isSignificantLeadSwing(yesterday, dayBefore);
                return (
                  <tr
                    key={account.id}
                    className="border-t border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients-ads/${account.id}`}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {account.client_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {account.meta_ad_account_id}
                    </td>
                    <LeadDayCell value={yesterday} warn={warn} />
                    <LeadDayCell value={dayBefore} warn={warn} />
                    <td className="px-4 py-3 text-slate-600">
                      {status === "pending" ? (
                        <span className="text-amber-800">Backfilling…</span>
                      ) : status === "error" ? (
                        <span className="text-red-700">Backfill error</span>
                      ) : (
                        <span className="text-slate-500">Ready</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
