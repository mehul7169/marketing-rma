import { BetaAnalyticsDataClient } from "@google-analytics/data";
import {
  mergeAndUpsertWebsiteDaily,
  type WebsiteDailyRow
} from "@/lib/db/website_daily";

export type GA4MetricValue = { value: string };
export type GA4ReportRow = {
  dimensionValues: Array<{ value: string }>;
  metricValues: GA4MetricValue[];
};

export type GA4IngestConfig = {
  propertyId: string;
  serviceAccountJson: string;
};

/** GA4 returns dates as YYYYMMDD; normalize to YYYY-MM-DD. */
export function ga4DateToISO(ga4Date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(ga4Date)) return ga4Date;
  if (/^\d{8}$/.test(ga4Date)) {
    return `${ga4Date.slice(0, 4)}-${ga4Date.slice(4, 6)}-${ga4Date.slice(6, 8)}`;
  }
  return ga4Date;
}

export function transformGa4ReportRows(
  rows: GA4ReportRow[]
): Array<Partial<WebsiteDailyRow> & { date: string }> {
  const dateToValues = new Map<string, { sessions: number; totalUsers: number }>();

  for (const row of rows) {
    const rawDate = row.dimensionValues?.[0]?.value;
    if (!rawDate) continue;
    const date = ga4DateToISO(rawDate);
    const sessions = Number(row.metricValues?.[0]?.value ?? "0");
    const totalUsers = Number(row.metricValues?.[1]?.value ?? "0");
    dateToValues.set(date, { sessions, totalUsers });
  }

  return Array.from(dateToValues.entries()).map(([date, values]) => ({
    date,
    lead_source: null,
    utm_campaign: null,
    landing_page_visits: values.sessions,
    unique_visitors: values.totalUsers
  }));
}

let cachedClient: BetaAnalyticsDataClient | null = null;
let cachedCredentialsKey: string | null = null;

function getGa4Client(serviceAccountJson: string): BetaAnalyticsDataClient {
  if (cachedClient && cachedCredentialsKey === serviceAccountJson) {
    return cachedClient;
  }
  const serviceAccount = JSON.parse(serviceAccountJson) as Record<string, unknown>;
  cachedClient = new BetaAnalyticsDataClient({
    credentials: serviceAccount as never
  });
  cachedCredentialsKey = serviceAccountJson;
  return cachedClient;
}

export async function fetchGa4Report(
  config: GA4IngestConfig,
  sinceISO: string,
  untilISO: string
): Promise<GA4ReportRow[]> {
  const client = getGa4Client(config.serviceAccountJson);

  const [response] = await client.runReport({
    property: `properties/${config.propertyId}`,
    dateRanges: [{ startDate: sinceISO, endDate: untilISO }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }],
    limit: 100000
  });

  return (response?.rows ?? []) as GA4ReportRow[];
}

export async function ingestGa4Range(
  config: GA4IngestConfig,
  sinceISO: string,
  untilISO: string
): Promise<number> {
  const rows = await fetchGa4Report(config, sinceISO, untilISO);
  const payload = transformGa4ReportRows(rows);
  if (payload.length > 0) {
    await mergeAndUpsertWebsiteDaily(payload);
  }
  return payload.length;
}

export function getGa4IngestConfigFromEnv(): GA4IngestConfig {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const serviceAccountJson = process.env.GA4_SERVICE_ACCOUNT_JSON;

  if (!propertyId || !serviceAccountJson) {
    throw new Error("Missing GA4_PROPERTY_ID or GA4_SERVICE_ACCOUNT_JSON");
  }

  return { propertyId, serviceAccountJson };
}
