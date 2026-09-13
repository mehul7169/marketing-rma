import { upsertMetaAdsDaily } from "@/lib/db/meta_ads_daily";
import type { MetaAdsDailyRow } from "@/lib/db/meta_ads_daily";
import { listActiveAdAccounts } from "@/lib/db/ad_accounts";

export type MetaAction = { action_type: string; value: string };
export type MetaCostPerAction = { action_type: string; value: string };

/**
 * Insights fields requested from Meta. Add new names here when extending
 * ingestion — keep this as the single source of truth (not scattered inline).
 */
export const META_INSIGHTS_FIELDS = [
  "date_start",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "reach",
  "cpm",
  "clicks",
  "ctr",
  "cpc",
  "actions",
  "unique_actions",
  "outbound_clicks",
  "outbound_clicks_ctr",
  "unique_outbound_clicks",
  "unique_outbound_clicks_ctr",
  "cost_per_outbound_click",
  "cost_per_unique_outbound_click",
  "cost_per_action_type"
] as const;

/**
 * Meta Ads Manager "Results" — exact `lead` action (confirmed via Graph API
 * Explorer against known form-fill counts).
 */
export const META_RESULT_ACTION_TYPE = "lead";

/**
 * Call bookings — custom conversion `offsite_conversion.fb_pixel_custom`
 * (confirmed via Graph API Explorer; matched known appointment counts).
 * Do not use initiate_checkout or its variants — those inflate (checkout
 * step interactions, not completed bookings).
 */
export const META_APPOINTMENT_ACTION_TYPE = "offsite_conversion.fb_pixel_custom";

export type MetaInsightsRow = {
  date_start: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string;
  adset_name: string | null;
  ad_id: string;
  ad_name: string | null;
  spend: string | null;
  impressions: string | null;
  reach: string | null;
  cpm: string | null;
  clicks: string | null;
  ctr: string | null;
  cpc: string | null;
  actions: MetaAction[] | null;
  unique_actions: MetaAction[] | null;
  outbound_clicks: MetaAction[] | null;
  outbound_clicks_ctr: MetaAction[] | null;
  unique_outbound_clicks: MetaAction[] | null;
  unique_outbound_clicks_ctr: MetaAction[] | null;
  cost_per_outbound_click: MetaCostPerAction[] | null;
  cost_per_unique_outbound_click: MetaCostPerAction[] | null;
  cost_per_action_type: MetaCostPerAction[] | null;
};

export type MetaIngestConfig = {
  accessToken: string;
  adAccountId: string;
};

function numOrNull(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Sum `value` across entries matching `actionType` (defensive if Meta returns multiples). */
export function sumActionType(
  entries: Array<{ action_type: string; value: string }> | null | undefined,
  actionType: string
): number | null {
  if (!entries || entries.length === 0) return null;
  let sum = 0;
  let found = false;
  for (const a of entries) {
    if (a.action_type !== actionType) continue;
    const n = Number(a.value);
    if (!Number.isFinite(n)) continue;
    sum += n;
    found = true;
  }
  return found ? sum : null;
}

/** First matching cost (Meta returns one per type); falls back to null. */
export function costForActionType(
  entries: MetaCostPerAction[] | null | undefined,
  actionType: string
): number | null {
  if (!entries || entries.length === 0) return null;
  const hit = entries.find((a) => a.action_type === actionType);
  if (!hit) return null;
  return numOrNull(hit.value);
}

export function extractLeads(actions: MetaAction[] | null): number | null {
  if (!actions || actions.length === 0) return null;
  const leadAction = actions.find((a) => {
    const t = a.action_type.toLowerCase();
    return t === "lead" || t.includes("lead");
  });
  if (!leadAction) return null;
  const n = Number(leadAction.value);
  return Number.isFinite(n) ? n : null;
}

export function extractCostPerLead(
  costPerAction: MetaCostPerAction[] | null
): number | null {
  if (!costPerAction || costPerAction.length === 0) return null;
  const leadCPA = costPerAction.find((a) =>
    a.action_type.toLowerCase().includes("lead")
  );
  if (!leadCPA) return null;
  const n = Number(leadCPA.value);
  return Number.isFinite(n) ? n : null;
}

function ratioOrNull(spend: number | null, count: number | null): number | null {
  if (spend === null || count === null || count <= 0) return null;
  return spend / count;
}

export function transformMetaInsightsRows(
  rows: MetaInsightsRow[],
  adAccountId: string,
  orgId: string
): Array<
  Partial<MetaAdsDailyRow> & {
    date: string;
    org_id: string;
    ad_account_id: string;
    ad_id: string;
    ad_set_id: string;
  }
> {
  return rows
    .filter((r) => r.ad_id && r.adset_id && r.date_start)
    .map((r) => {
      const leads = extractLeads(r.actions);
      const costPerLead = extractCostPerLead(r.cost_per_action_type);
      const spend = numOrNull(r.spend);
      const clicks = numOrNull(r.clicks);
      const computedCostPerLead =
        spend !== null && leads && leads > 0 ? spend / leads : null;
      const computedLpConversionRate =
        leads !== null && clicks !== null && clicks > 0 ? leads / clicks : null;

      const results = sumActionType(r.actions, META_RESULT_ACTION_TYPE);
      const appointmentsScheduled = sumActionType(
        r.actions,
        META_APPOINTMENT_ACTION_TYPE
      );
      const uniqueOutboundClicks = sumActionType(
        r.unique_outbound_clicks,
        "outbound_click"
      );
      const uniqueOutboundCtr = sumActionType(
        r.unique_outbound_clicks_ctr,
        "outbound_click"
      );
      const costPerUniqueOutbound =
        costForActionType(r.cost_per_unique_outbound_click, "outbound_click") ??
        ratioOrNull(spend, uniqueOutboundClicks);

      const costPerResult =
        costForActionType(r.cost_per_action_type, META_RESULT_ACTION_TYPE) ??
        ratioOrNull(spend, results);
      const costPerAppointment =
        costForActionType(r.cost_per_action_type, META_APPOINTMENT_ACTION_TYPE) ??
        ratioOrNull(spend, appointmentsScheduled);

      return {
        date: r.date_start,
        org_id: orgId,
        ad_account_id: adAccountId,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        ad_set_id: r.adset_id,
        ad_set_name: r.adset_name,
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        // Thumbnail would require one extra Graph call per ad; skip during
        // ingest so spend/leads are never blocked by rate limits.
        creative_thumbnail_url: null,
        utm_term: null,
        spend,
        impressions: numOrNull(r.impressions),
        reach: numOrNull(r.reach),
        cpm: numOrNull(r.cpm),
        clicks,
        ctr: numOrNull(r.ctr),
        cpc: numOrNull(r.cpc),
        leads_meta_reported: leads,
        cost_per_lead: costPerLead ?? computedCostPerLead,
        lp_conversion_rate: computedLpConversionRate,
        actions: r.actions ?? null,
        results,
        cost_per_result: costPerResult,
        unique_outbound_clicks: uniqueOutboundClicks,
        unique_outbound_ctr: uniqueOutboundCtr,
        cost_per_unique_outbound_click: costPerUniqueOutbound,
        appointments_scheduled: appointmentsScheduled,
        cost_per_appointment_scheduled: costPerAppointment
      };
    });
}

export async function fetchMetaInsights(
  config: MetaIngestConfig,
  sinceISO: string,
  untilISO: string
): Promise<MetaInsightsRow[]> {
  const actId = config.adAccountId.startsWith("act_")
    ? config.adAccountId
    : `act_${config.adAccountId}`;
  const endpoint = `https://graph.facebook.com/v19.0/${actId}/insights`;

  const params = new URLSearchParams({
    access_token: config.accessToken,
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since: sinceISO, until: untilISO }),
    fields: META_INSIGHTS_FIELDS.join(",")
  });

  const rows: MetaInsightsRow[] = [];
  let url: string | null = `${endpoint}?${params.toString()}`;

  for (let page = 0; page < 50 && url; page++) {
    const res = await fetch(url, { method: "GET" });
    const json = (await res.json()) as {
      data?: MetaInsightsRow[];
      paging?: { next?: string };
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(
        `Meta insights error: ${json.error?.message ?? JSON.stringify(json).slice(0, 1000)}`
      );
    }

    if (json.data) rows.push(...json.data);
    url = json.paging?.next ?? null;
  }

  return rows;
}

export async function ingestMetaAdsRange(
  config: MetaIngestConfig,
  sinceISO: string,
  untilISO: string,
  /** Internal ad_accounts.id stamped onto every upserted row. */
  adAccountId: string,
  orgId: string
): Promise<number> {
  const raw = await fetchMetaInsights(config, sinceISO, untilISO);
  const payload = transformMetaInsightsRows(raw, adAccountId, orgId);
  if (payload.length > 0) {
    await upsertMetaAdsDaily(payload);
  }
  return payload.length;
}

export function getMetaAccessTokenFromEnv(): string {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("Missing META_ACCESS_TOKEN");
  }
  return accessToken;
}

/** @deprecated Prefer ad_accounts + getMetaAccessTokenFromEnv for multi-account ingest. */
export function getMetaIngestConfigFromEnv(): MetaIngestConfig {
  const accessToken = getMetaAccessTokenFromEnv();
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!adAccountId) {
    throw new Error("Missing META_AD_ACCOUNT_ID");
  }

  return { accessToken, adAccountId };
}

/**
 * Pause between Meta accounts so ~20 sequential pulls stay under Graph rate
 * limits. Not an arbitrary sleep — Meta throttles concurrent act_* insights.
 */
export const META_ACCOUNT_INGEST_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type MetaAccountIngestResult = {
  adAccountId: string;
  clientName: string;
  metaAdAccountId: string;
  rowsUpserted: number;
  error: string | null;
};

export type MetaMultiAccountIngestSummary = {
  rowsUpserted: number;
  accountsAttempted: number;
  accountsSucceeded: number;
  accountsFailed: number;
  results: MetaAccountIngestResult[];
};

/**
 * Pull insights for one ad_accounts row over a date range and upsert tagged rows.
 */
export async function ingestMetaAdsForAccount(
  account: {
    id: string;
    org_id: string;
    meta_ad_account_id: string;
    client_name: string;
  },
  sinceISO: string,
  untilISO: string,
  accessToken?: string
): Promise<number> {
  const token = accessToken ?? getMetaAccessTokenFromEnv();
  return ingestMetaAdsRange(
    { accessToken: token, adAccountId: account.meta_ad_account_id },
    sinceISO,
    untilISO,
    account.id,
    account.org_id
  );
}

/**
 * Sequentially ingest every active ad_accounts row. One account's failure is
 * logged and skipped so the rest still complete.
 */
export async function ingestMetaAdsForActiveAccounts(
  sinceISO: string,
  untilISO: string,
  options?: {
    accounts?: Array<{
      id: string;
      org_id: string;
      meta_ad_account_id: string;
      client_name: string;
    }>;
    accessToken?: string;
    delayMs?: number;
    onAccountStart?: (account: { id: string; client_name: string }) => void;
    onAccountDone?: (result: MetaAccountIngestResult) => void;
  }
): Promise<MetaMultiAccountIngestSummary> {
  const accounts = options?.accounts ?? (await listActiveAdAccounts());
  const token = options?.accessToken ?? getMetaAccessTokenFromEnv();
  const delayMs = options?.delayMs ?? META_ACCOUNT_INGEST_DELAY_MS;

  if (accounts.length === 0) {
    throw new Error(
      "No active rows in ad_accounts — seed at least the RMA lead-source account before ingesting."
    );
  }

  const results: MetaAccountIngestResult[] = [];
  let rowsUpserted = 0;
  let accountsSucceeded = 0;
  let accountsFailed = 0;

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i]!;
    options?.onAccountStart?.({ id: account.id, client_name: account.client_name });

    let result: MetaAccountIngestResult;
    try {
      const rows = await ingestMetaAdsForAccount(account, sinceISO, untilISO, token);
      result = {
        adAccountId: account.id,
        clientName: account.client_name,
        metaAdAccountId: account.meta_ad_account_id,
        rowsUpserted: rows,
        error: null
      };
      rowsUpserted += rows;
      accountsSucceeded += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        `Meta ingest failed for ${account.client_name} (${account.meta_ad_account_id}): ${message}`
      );
      result = {
        adAccountId: account.id,
        clientName: account.client_name,
        metaAdAccountId: account.meta_ad_account_id,
        rowsUpserted: 0,
        error: message
      };
      accountsFailed += 1;
    }

    results.push(result);
    options?.onAccountDone?.(result);

    // Rate-limit buffer between accounts (see META_ACCOUNT_INGEST_DELAY_MS).
    if (i < accounts.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    rowsUpserted,
    accountsAttempted: accounts.length,
    accountsSucceeded,
    accountsFailed,
    results
  };
}
