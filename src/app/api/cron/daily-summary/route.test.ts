import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { emptyCounts } from "@/lib/insights/setterActivity";

const postSlackWebhook = vi.fn();
const logCronRun = vi.fn();

vi.mock("@/lib/slack/notify", () => ({ postSlackWebhook: (...a: unknown[]) => postSlackWebhook(...a) }));
vi.mock("@/lib/db/cron_runs", () => ({ logCronRun: (...a: unknown[]) => logCronRun(...a) }));
vi.mock("@/lib/orgs/getOrgIdBySlug", () => ({ getOrgIdBySlug: async () => "org-rma" }));
vi.mock("@/lib/reports/gatherDailySummary", () => ({
  gatherDailySummary: async (orgId: string, dateISO: string, asOf: Date) => ({
    dateISO,
    asOf,
    setter: { daily: [], users: [], orgTotals: emptyCounts(), userTotals: emptyCounts() },
    adSpend: 100,
    leadsReceived: 4,
    callsBooked: 1,
    metaLastRun: null,
    orgId
  })
}));

import { GET } from "@/app/api/cron/daily-summary/route";

function req(path: string, secret = "s3cret") {
  return new NextRequest(`http://localhost${path}`, {
    headers: { authorization: `Bearer ${secret}` }
  });
}

describe("GET /api/cron/daily-summary", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("SLACK_DAILY_SUMMARY_WEBHOOK_URL", "https://hooks.example/test");
    postSlackWebhook.mockReset();
    logCronRun.mockReset();
  });

  it("rejects a wrong cron secret", async () => {
    const res = await GET(req("/api/cron/daily-summary", "nope"));
    expect(res.status).toBe(401);
    expect(postSlackWebhook).not.toHaveBeenCalled();
  });

  it("dry run returns the payload without posting or logging", async () => {
    const res = await GET(req("/api/cron/daily-summary?dry_run=1"));
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.message.blocks.length).toBeGreaterThan(0);
    expect(postSlackWebhook).not.toHaveBeenCalled();
    expect(logCronRun).not.toHaveBeenCalled();
  });

  it("posts to the daily-summary webhook and logs success", async () => {
    const res = await GET(req("/api/cron/daily-summary"));
    expect(res.status).toBe(200);
    expect(postSlackWebhook).toHaveBeenCalledWith(
      "https://hooks.example/test",
      expect.stringContaining("Daily summary"),
      expect.any(Array)
    );
    expect(logCronRun).toHaveBeenCalledWith(expect.objectContaining({ job: "daily-summary", status: "success" }));
  });

  it("fails loudly when the webhook env var is missing", async () => {
    vi.stubEnv("SLACK_DAILY_SUMMARY_WEBHOOK_URL", "");
    const res = await GET(req("/api/cron/daily-summary"));
    expect(res.status).toBe(500);
    expect(postSlackWebhook).not.toHaveBeenCalled();
    expect(logCronRun).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
  });
});
