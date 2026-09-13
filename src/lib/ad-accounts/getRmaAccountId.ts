import { getLeadSourceAdAccount } from "@/lib/db/ad_accounts";

/**
 * Lead-source ad_accounts.id for an org — what meta_ads_daily.ad_account_id
 * stores for that org's RMA/internal account.
 *
 * Concurrent callers for the same orgId share one in-flight lookup.
 */
const inflightByOrg = new Map<string, Promise<string | null>>();

export function getRmaAccountId(orgId: string): Promise<string | null> {
  let inflight = inflightByOrg.get(orgId);
  if (!inflight) {
    inflight = getLeadSourceAdAccount(orgId)
      .then((account) => account?.id ?? null)
      .finally(() => {
        queueMicrotask(() => {
          inflightByOrg.delete(orgId);
        });
      });
    inflightByOrg.set(orgId, inflight);
  }
  return inflight;
}
