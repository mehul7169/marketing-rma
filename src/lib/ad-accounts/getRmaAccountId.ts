import { listActiveAdAccountsForOrg } from "@/lib/db/ad_accounts";

/**
 * ad_accounts.id values for this org's Meta account(s) on /meta-ads.
 * All active rows for the org — does not read is_lead_source.
 *
 * Concurrent callers for the same orgId share one in-flight lookup.
 */
const inflightByOrg = new Map<string, Promise<string[]>>();

export function getOrgMetaAdAccountIds(orgId: string): Promise<string[]> {
  let inflight = inflightByOrg.get(orgId);
  if (!inflight) {
    inflight = listActiveAdAccountsForOrg(orgId)
      .then((accounts) => accounts.map((a) => a.id))
      .finally(() => {
        queueMicrotask(() => {
          inflightByOrg.delete(orgId);
        });
      });
    inflightByOrg.set(orgId, inflight);
  }
  return inflight;
}

/** First active account id, or null — for single-id call sites. */
export async function getOrgMetaAdAccountId(
  orgId: string
): Promise<string | null> {
  const ids = await getOrgMetaAdAccountIds(orgId);
  return ids[0] ?? null;
}

/** @deprecated Use getOrgMetaAdAccountId / getOrgMetaAdAccountIds. */
export const getRmaAccountId = getOrgMetaAdAccountId;
