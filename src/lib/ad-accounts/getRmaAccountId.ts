import { getLeadSourceAdAccount } from "@/lib/db/ad_accounts";

/**
 * Single source of truth for "which account is RMA's own."
 *
 * Resolves the `ad_accounts` row where `is_lead_source = true` and returns its
 * primary key (`id`). That UUID is what `meta_ads_daily.ad_account_id` stores
 * (not the Meta Graph `act_…` id / meta_ad_account_id).
 *
 * Concurrent callers share one in-flight lookup (per-request dedupe on a page
 * load that hits this helper from several places at once).
 */
let inflight: Promise<string | null> | null = null;

export function getRmaAccountId(): Promise<string | null> {
  if (!inflight) {
    inflight = getLeadSourceAdAccount()
      .then((account) => account?.id ?? null)
      .finally(() => {
        // Allow a later request in a long-lived worker to refresh.
        queueMicrotask(() => {
          inflight = null;
        });
      });
  }
  return inflight;
}
