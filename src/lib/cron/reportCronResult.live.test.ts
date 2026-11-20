import "dotenv/config";
import { describe, expect, it } from "vitest";
import { postSlackWebhook } from "@/lib/slack/notify";
import {
  buildCronFailureAlert,
  cronAlertWebhookUrl,
  failureStreak,
  inspectCronFailure,
  listCronRunsNewestFirst
} from "@/lib/cron/reportCronResult";
import { formatIST } from "@/lib/timezone";

const hasDb =
  process.env.LIVE_DB === "1" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasDb)("cron alert live dry-run", () => {
  it("reports meta-ads failing since 11 Oct without posting", async () => {
    const runs = await listCronRunsNewestFirst("meta-ads");
    const streak = failureStreak(runs);
    const inspect = await inspectCronFailure("meta-ads");
    const sinceDay = streak.failingSince
      ? formatIST(streak.failingSince, "d MMM yyyy")
      : null;
    const message =
      inspect.action === "failure" && inspect.failingSince
        ? buildCronFailureAlert({
            job: "meta-ads",
            streak: inspect.streak,
            failingSince: inspect.failingSince,
            lastError: inspect.lastError
          })
        : null;
    console.log(
      JSON.stringify(
        {
          posted: false,
          latest: inspect.latest,
          streak: inspect.streak,
          failingSince: inspect.failingSince,
          sinceDay,
          action: inspect.action,
          message
        },
        null,
        2
      )
    );
    expect(inspect.latest?.status).toBe("error");
    expect(inspect.streak).toBeGreaterThanOrEqual(3);
    expect(sinceDay).toMatch(/11 Oct 2026/);
    expect(message).toContain("Meta access token expired");
    expect(message).not.toContain("hooks.slack.com");
  });
});

const canPost =
  hasDb &&
  process.env.POST_CRON_ALERT === "1" &&
  Boolean(cronAlertWebhookUrl());

describe.skipIf(!canPost)("cron alert one-off Slack post", () => {
  it("posts the live meta-ads failure message once", async () => {
    const inspect = await inspectCronFailure("meta-ads");
    expect(inspect.failingSince).toBeTruthy();
    const text = buildCronFailureAlert({
      job: "meta-ads",
      streak: inspect.streak,
      failingSince: inspect.failingSince!,
      lastError: inspect.lastError
    });
    const url = cronAlertWebhookUrl();
    expect(url).toBeTruthy();
    await postSlackWebhook(url!, text, [
      { type: "section", text: { type: "mrkdwn", text } }
    ]);
    console.log(
      JSON.stringify({
        posted: true,
        streak: inspect.streak,
        failingSince: inspect.failingSince,
        textPreview: text.slice(0, 180)
      })
    );
  });
});
