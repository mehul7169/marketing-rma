import { actId } from "@/lib/adspend/parseTracker";
import { getMetaAccessTokenFromEnv } from "@/lib/ingest/meta";

/** Same Graph version as the meta-ads ingest cron. */
export const GRAPH_VERSION = "v19.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80004]);
export const SKIP_NO_ZERO_CODES = new Set([190, 200]);
export const META_POOL = 5;
export const MANAN_SUSPECT_BUSINESS_ID = "105914420408512";

export type GraphError = {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
};

export type MetaAccountInfo = {
  id: string;
  account_id: string;
  name: string;
  currency: string;
  account_status: number | null;
};

export type DaySpend = {
  dateISO: string;
  spend: number;
  currency: string | null;
};

export type AccountValidation =
  | { ok: true; account: MetaAccountInfo }
  | { ok: false; error: string; code: number | null; isPermission: boolean };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRateLimitCode(code: number | null | undefined): boolean {
  return code != null && RATE_LIMIT_CODES.has(code);
}

export function formatGraphError(err: GraphError | undefined, fallback: string): string {
  if (!err) return fallback;
  const code = err.code != null ? ` #${err.code}` : "";
  const sub = err.error_subcode != null ? `/${err.error_subcode}` : "";
  return `${err.message}${code}${sub}`.trim();
}

async function graphFetch(
  url: string,
  init: RequestInit | undefined,
  label: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ json: Record<string, unknown>; error: GraphError | null }> {
  const maxAttempts = 4;
  let lastError: GraphError | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetchImpl(url, init);
    const json = (await res.json()) as Record<string, unknown>;
    const err = (json.error as GraphError | undefined) ?? null;
    if (!err) return { json, error: null };
    lastError = err;
    if (!isRateLimitCode(err.code) || attempt === maxAttempts) {
      return { json, error: err };
    }
    const delayMs = 500 * 2 ** (attempt - 1);
    console.warn(
      `${label}: Meta rate limit ${err.code} (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms`
    );
    await sleep(delayMs);
  }
  return { json: { error: lastError }, error: lastError };
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length) || 1);
  if (items.length === 0) return [];
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export function parseSpend(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

type GraphDeps = {
  accessToken: string;
  fetchImpl: typeof fetch;
};

function tokenDeps(overrides?: Partial<GraphDeps>): GraphDeps {
  return {
    accessToken: overrides?.accessToken ?? getMetaAccessTokenFromEnv(),
    fetchImpl: overrides?.fetchImpl ?? fetch
  };
}

export async function validateAdAccount(
  adAccountId: string,
  overrides?: Partial<GraphDeps>
): Promise<AccountValidation> {
  const { accessToken, fetchImpl } = tokenDeps(overrides);
  const id = actId(adAccountId);
  const url = new URL(`${GRAPH_BASE}/${id}`);
  url.searchParams.set("fields", "name,account_id,currency,account_status");
  url.searchParams.set("access_token", accessToken);
  const { json, error } = await graphFetch(url.toString(), { method: "GET" }, `validate ${id}`, fetchImpl);
  if (error) {
    const code = error.code ?? null;
    return {
      ok: false,
      error: formatGraphError(error, `Meta validate failed for ${id}`),
      code,
      isPermission: code != null && SKIP_NO_ZERO_CODES.has(code)
    };
  }
  return {
    ok: true,
    account: {
      id: String(json.id ?? id),
      account_id: String(json.account_id ?? adAccountId),
      name: String(json.name ?? ""),
      currency: String(json.currency ?? ""),
      account_status:
        typeof json.account_status === "number" ? json.account_status : null
    }
  };
}

type InsightsRow = {
  spend?: string;
  account_currency?: string;
  date_start?: string;
};

export async function fetchAccountDailySpend(
  adAccountId: string,
  sinceISO: string,
  untilISO: string,
  overrides?: Partial<GraphDeps>
): Promise<{ days: DaySpend[]; error: string | null; code: number | null; isPermission: boolean }> {
  const { accessToken, fetchImpl } = tokenDeps(overrides);
  const id = actId(adAccountId);
  const url = new URL(`${GRAPH_BASE}/${id}/insights`);
  url.searchParams.set("level", "account");
  url.searchParams.set("fields", "spend,account_currency");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since: sinceISO, until: untilISO }));
  url.searchParams.set("access_token", accessToken);

  const days: DaySpend[] = [];
  let nextUrl: string | null = url.toString();
  for (let page = 0; page < 20 && nextUrl; page += 1) {
    const { json, error } = await graphFetch(
      nextUrl,
      { method: "GET" },
      `insights ${id}`,
      fetchImpl
    );
    if (error) {
      const code = error.code ?? null;
      return {
        days: [],
        error: formatGraphError(error, `Meta insights failed for ${id}`),
        code,
        isPermission: code != null && SKIP_NO_ZERO_CODES.has(code)
      };
    }
    const rows = (json.data as InsightsRow[] | undefined) ?? [];
    for (const row of rows) {
      if (!row.date_start) continue;
      days.push({
        dateISO: row.date_start,
        spend: parseSpend(row.spend),
        currency: row.account_currency ?? null
      });
    }
    const paging = json.paging as { next?: string } | undefined;
    nextUrl = paging?.next ?? null;
  }
  return { days, error: null, code: null, isPermission: false };
}

export async function listBusinessAdAccounts(
  businessId: string,
  overrides?: Partial<GraphDeps>
): Promise<{ accounts: MetaAccountInfo[]; errors: string[] }> {
  const { accessToken, fetchImpl } = tokenDeps(overrides);
  const edges = ["owned_ad_accounts", "client_ad_accounts"] as const;
  const accounts: MetaAccountInfo[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    const url = new URL(`${GRAPH_BASE}/${businessId}/${edge}`);
    url.searchParams.set("fields", "id,name,account_id,currency,account_status");
    url.searchParams.set("limit", "50");
    url.searchParams.set("access_token", accessToken);
    const { json, error } = await graphFetch(
      url.toString(),
      { method: "GET" },
      `${edge} ${businessId}`,
      fetchImpl
    );
    if (error) {
      errors.push(`${edge}: ${formatGraphError(error, "failed")}`);
      continue;
    }
    const rows = (json.data as MetaAccountInfo[] | undefined) ?? [];
    for (const row of rows) {
      const accountId = String(row.account_id ?? row.id ?? "").replace(/^act_/, "");
      if (!accountId || seen.has(accountId)) continue;
      seen.add(accountId);
      accounts.push({
        id: String(row.id ?? `act_${accountId}`),
        account_id: accountId,
        name: String(row.name ?? ""),
        currency: String(row.currency ?? ""),
        account_status: row.account_status ?? null
      });
    }
  }
  return { accounts, errors };
}
