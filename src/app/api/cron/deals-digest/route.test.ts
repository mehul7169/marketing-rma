import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const postSlackWebhook = vi.fn();
const logCronRun = vi.fn();
const gatherDealsDigest = vi.fn();

vi.mock("@/lib/slack/notify", () => ({
  postSlackWebhook: (...a: unknown[]) => postSlackWebhook(...a)
}));
vi.mock("@/lib/db/cron_runs", () => ({
  logCronRun: (...a: unknown[]) => logCronRun(...a)
}));
vi.mock("@/lib/orgs/getOrgIdBySlug", () => ({
  getOrgIdBySlug: async () => "org-rma"
}));
vi.mock("@/lib/deals/dealsDigest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/deals/dealsDigest")>();
  return {
    ...actual,
    gatherDealsDigest: (...a: unknown[]) => gatherDealsDigest(...a)
  };
});

import { GET } from "@/app/api/cron/deals-digest/route";

function req(path: string, secret = "s3cret") {
  return new NextRequest(`http://localhost${path}`, {
    headers: { authorization: `Bearer ${secret}` }
  });
}

const digest = {
  dateISO: "2026-11-20",
  asOf: new Date("2026-11-20T04:30:00.000Z"),
  metrics: { overdue: 2, dueToday: 1, needsNextStep: 3 },
  owners: [
    {
      ownerId: "owner-a",
      ownerLabel: "Kunal",
      lines: [
        {
          leadId: "d1",
          name: "Kunal Jiwani",
          nextStep: "Call to discuss pricing",
          dueLabel: "(yesterday 4:00 PM)",
          overdue: true
        }
      ]
    }
  ],
  truncated: 0
};

describe("GET /api/cron/deals-digest", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("SLACK_DEALS_DIGEST_WEBHOOK_URL", "https://hooks.example/deals");
    vi.stubEnv("SLACK_DAILY_SUMMARY_WEBHOOK_URL", "https://hooks.example/daily");
    postSlackWebhook.mockReset();
    logCronRun.mockReset();
    gatherDealsDigest.mockReset();
    gatherDealsDigest.mockResolvedValue(digest);
  });

  it("rejects a wrong cron secret", async () => {
    const res = await GET(req("/api/cron/deals-digest", "nope"));
    expect(res.status).toBe(401);
    expect(postSlackWebhook).not.toHaveBeenCalled();
  });

  it("dry run returns the payload without posting or logging", async () => {
    const res = await GET(req("/api/cron/deals-digest?dry_run=1"));
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.message.blocks.length).toBeGreaterThan(0);
    expect(postSlackWebhook).not.toHaveBeenCalled();
    expect(logCronRun).not.toHaveBeenCalled();
  });

  it("posts to the dedicated webhook and logs success", async () => {
    const res = await GET(req("/api/cron/deals-digest"));
    expect(res.status).toBe(200);
    expect(postSlackWebhook).toHaveBeenCalledWith(
      "https://hooks.example/deals",
      expect.stringContaining("Deal follow-ups"),
      expect.any(Array)
    );
    expect(logCronRun).toHaveBeenCalledWith(
      expect.objectContaining({ job: "deals-digest", status: "success" })
    );
  });

  it("falls back to the daily-summary webhook when the dedicated var is empty", async () => {
    vi.stubEnv("SLACK_DEALS_DIGEST_WEBHOOK_URL", "");
    const res = await GET(req("/api/cron/deals-digest"));
    expect(res.status).toBe(200);
    expect(postSlackWebhook).toHaveBeenCalledWith(
      "https://hooks.example/daily",
      expect.any(String),
      expect.any(Array)
    );
  });

  it("skips the post when no webhook is configured", async () => {
    vi.stubEnv("SLACK_DEALS_DIGEST_WEBHOOK_URL", "");
    vi.stubEnv("SLACK_DAILY_SUMMARY_WEBHOOK_URL", "");
    const res = await GET(req("/api/cron/deals-digest"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.skipped).toBe(true);
    expect(postSlackWebhook).not.toHaveBeenCalled();
    expect(logCronRun).toHaveBeenCalledWith(
      expect.objectContaining({ job: "deals-digest", status: "success" })
    );
  });
});
