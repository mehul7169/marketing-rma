import { describe, expect, it } from "vitest";
import type { CronRunLog } from "@/lib/db/cron_runs";
import {
  ALERT_COOLDOWN_MS,
  buildCronFailureAlert,
  clipError,
  decideCronAlert,
  isMetaTokenExpiry,
  reportCronResult,
  type CronAlertDeps,
  type CronAlertState,
  type CronRunSnapshot
} from "@/lib/cron/reportCronResult";

const TOKEN =
  "Error validating access token: Session has expired on Tuesday, 11th October 2026 02:30:00";
const T0 = new Date("2026-10-11T02:30:00.000Z"); // 08:00 IST

function hour(n: number): Date {
  return new Date(T0.getTime() + n * 60 * 60 * 1000);
}

function memoryDeps() {
  const runs: CronRunSnapshot[] = [];
  let state: CronAlertState | null = null;
  const posts: string[] = [];
  let now = T0;
  const deps = (): CronAlertDeps => ({
    now,
    listRuns: async () => runs.slice(),
    getState: async () => state,
    upsertState: async (row) => {
      state = { ...row };
    },
    deleteState: async () => {
      state = null;
    },
    post: async (text) => {
      posts.push(text);
    }
  });
  async function fail(at: Date, error = TOKEN) {
    now = at;
    runs.unshift({ status: "error", error, ran_at: at.toISOString() });
    return reportCronResult("meta-ads", { status: "error", error }, deps());
  }
  async function succeed(at: Date) {
    now = at;
    runs.unshift({ status: "success", error: null, ran_at: at.toISOString() });
    return reportCronResult("meta-ads", { status: "success", error: null }, deps());
  }
  return { fail, succeed, posts, getState: () => state };
}

describe("isMetaTokenExpiry / clipError", () => {
  it("detects Graph API session expiry", () => {
    expect(isMetaTokenExpiry(TOKEN)).toBe(true);
    expect(isMetaTokenExpiry("timeout")).toBe(false);
    expect(clipError("a".repeat(400))).toHaveLength(300);
  });
});

describe("buildCronFailureAlert", () => {
  it("uses the token copy and links Meta Ads", () => {
    const text = buildCronFailureAlert({
      job: "meta-ads",
      streak: 3,
      failingSince: T0.toISOString(),
      lastError: TOKEN
    });
    expect(text).toContain("⚠️ meta-ads has failed 3 times in a row since 08:00 IST.");
    expect(text).toContain("Meta access token expired. Reconnect with a long-lived token.");
    expect(text).toContain("https://tracking.runmoreads.in/meta-ads");
    expect(text).not.toContain("hooks.slack.com");
  });

  it("clips a generic last error to 300 chars", () => {
    const text = buildCronFailureAlert({
      job: "ga4",
      streak: 3,
      failingSince: T0.toISOString(),
      lastError: "boom " + "x".repeat(400)
    });
    expect(text).toContain("Last error:");
    const last = text.split("Last error: ")[1]?.split("\n")[0] ?? "";
    expect(last.length).toBeLessThanOrEqual(300);
  });
});

describe("decideCronAlert daily vs hourly", () => {
  it("alerts a daily job on the first failure", () => {
    const run: CronRunSnapshot = {
      status: "error",
      error: "Missing webhook",
      ran_at: T0.toISOString()
    };
    const d = decideCronAlert({
      job: "daily-summary",
      result: run,
      runsNewestFirst: [run],
      state: null,
      now: T0
    });
    expect(d.action).toBe("failure");
    expect(d.text).toContain("daily-summary has failed since 08:00 IST");
  });

  it("alerts adspend-sheet on the first failure", () => {
    const run: CronRunSnapshot = {
      status: "error",
      error: "All ad accounts failed",
      ran_at: T0.toISOString()
    };
    const d = decideCronAlert({
      job: "adspend-sheet",
      result: run,
      runsNewestFirst: [run],
      state: null,
      now: T0
    });
    expect(d.action).toBe("failure");
    expect(d.text).toContain("adspend-sheet has failed since 08:00 IST");
  });
});

describe("reportCronResult meta-ads streak", () => {
  it("alerts once on the 3rd failure, stays quiet for 20 more inside 24h, then recovers", async () => {
    const { fail, succeed, posts, getState } = memoryDeps();
    await fail(hour(0));
    await fail(hour(1));
    expect(posts).toHaveLength(0);

    const third = await fail(hour(2));
    expect(third.action).toBe("failure");
    expect(posts).toHaveLength(1);
    expect(posts[0]).toContain("has failed 3 times in a row since 08:00 IST");
    expect(posts[0]).toContain("Meta access token expired");
    expect(getState()?.failing_since).toBe(T0.toISOString());

    for (let i = 3; i <= 22; i += 1) {
      const d = await fail(hour(i));
      expect(d.action).toBe("none");
    }
    expect(posts).toHaveLength(1);
    expect(hour(22).getTime() - hour(2).getTime()).toBeLessThan(ALERT_COOLDOWN_MS);

    const recovered = await succeed(hour(23));
    expect(recovered.action).toBe("recovery");
    expect(posts).toHaveLength(2);
    expect(posts[1]).toBe("✅ meta-ads recovered");
    expect(getState()).toBeNull();
  });

  it("re-alerts after 24h while still failing", async () => {
    const { fail, posts } = memoryDeps();
    await fail(hour(0));
    await fail(hour(1));
    await fail(hour(2));
    expect(posts).toHaveLength(1);
    await fail(hour(2 + 25));
    expect(posts).toHaveLength(2);
    expect(posts[1]).toContain("⚠️ meta-ads has failed");
  });
});

describe("decideCronAlert cooldown uses stored last_alert_at", () => {
  it("does not treat a lone success as recovery without state", () => {
    const result: Pick<CronRunLog, "status" | "error"> = { status: "success", error: null };
    const d = decideCronAlert({
      job: "meta-ads",
      result,
      runsNewestFirst: [],
      state: null,
      now: T0
    });
    expect(d.action).toBe("none");
  });
});
