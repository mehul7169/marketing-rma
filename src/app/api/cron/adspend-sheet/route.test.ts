import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const logCronRun = vi.fn();
const syncAdspendSheet = vi.fn();

vi.mock("@/lib/db/cron_runs", () => ({
  logCronRun: (...a: unknown[]) => logCronRun(...a)
}));
vi.mock("@/lib/adspend/sync", () => ({
  ADSPEND_JOB: "adspend-sheet",
  adspendRunNotes: () => "notes",
  buildAdspendSlackText: () => null,
  syncAdspendSheet: (...a: unknown[]) => syncAdspendSheet(...a)
}));
vi.mock("@/lib/slack/notify", () => ({
  postSlackWebhook: vi.fn()
}));
vi.mock("@/lib/cron/reportCronResult", () => ({
  cronAlertWebhookUrl: () => null
}));

import { GET } from "@/app/api/cron/adspend-sheet/route";

function req(path: string, secret = "s3cret") {
  return new NextRequest(`http://localhost${path}`, {
    headers: { authorization: `Bearer ${secret}` }
  });
}

const okResult = {
  ok: true,
  error: null,
  rowsUpserted: 12,
  accounts: [{ client: "Karan", status: "ok", error: null }],
  skippedNoId: [],
  writeTarget: { tab: "Data" }
};

describe("GET /api/cron/adspend-sheet", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    logCronRun.mockReset();
    syncAdspendSheet.mockReset();
    syncAdspendSheet.mockResolvedValue(okResult);
  });

  it("rejects a wrong cron secret", async () => {
    const res = await GET(req("/api/cron/adspend-sheet", "nope"));
    expect(res.status).toBe(401);
    expect(syncAdspendSheet).not.toHaveBeenCalled();
  });

  it("dry run skips cron_runs", async () => {
    const res = await GET(req("/api/cron/adspend-sheet?dry_run=1&from=2026-11-24&to=2026-11-24"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.dryRun).toBe(true);
    expect(syncAdspendSheet).toHaveBeenCalledWith({
      fromISO: "2026-11-24",
      toISO: "2026-11-24",
      dryRun: true
    });
    expect(logCronRun).not.toHaveBeenCalled();
  });

  it("logs success with job adspend-sheet and rows_upserted", async () => {
    const res = await GET(req("/api/cron/adspend-sheet"));
    expect(res.status).toBe(200);
    expect(logCronRun).toHaveBeenCalledWith(
      expect.objectContaining({
        job: "adspend-sheet",
        status: "success",
        rows_upserted: 12
      })
    );
  });

  it("skips a bad account, logs the error, and fails only when every account fails", async () => {
    syncAdspendSheet.mockResolvedValue({
      ok: false,
      error: "All ad accounts failed",
      rowsUpserted: 0,
      accounts: [
        {
          client: "Manan",
          status: "error",
          error: "Unsupported get request #100",
          adAccountId: "105914420408512"
        }
      ],
      skippedNoId: []
    });
    const res = await GET(req("/api/cron/adspend-sheet"));
    expect(res.status).toBe(500);
    expect(logCronRun).toHaveBeenCalledWith(
      expect.objectContaining({
        job: "adspend-sheet",
        status: "error",
        error: expect.stringContaining("All ad accounts failed")
      })
    );
  });
});
