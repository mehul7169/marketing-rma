import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/db/cron_runs";
import {
  buildDealsDigestMessage,
  dealsDigestWebhookUrl,
  gatherDealsDigest
} from "@/lib/deals/dealsDigest";
import { getOrgIdBySlug } from "@/lib/orgs/getOrgIdBySlug";
import { postSlackWebhook } from "@/lib/slack/notify";
import { assertCronSecret } from "@/lib/utils/cronAuth";

export const runtime = "nodejs";

/**
 * 9:00 AM IST deal follow-ups (vercel.json "30 3 * * *" — Vercel cron is UTC).
 * RMA-only. Posts only when a webhook is configured (SLACK_DEALS_DIGEST_WEBHOOK_URL,
 * else SLACK_DAILY_SUMMARY_WEBHOOK_URL).
 * `?dry_run=1` returns the payload without posting or logging.
 */
export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry_run") === "1";

  try {
    const orgId = await getOrgIdBySlug("rma");
    const digest = await gatherDealsDigest(orgId);
    const message = buildDealsDigestMessage(digest);

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, digest, message });
    }

    const url = dealsDigestWebhookUrl();
    if (!url) {
      await logCronRun({
        job: "deals-digest",
        status: "success",
        rows_upserted: null,
        error: null
      });
      return NextResponse.json({ ok: true, skipped: true, reason: "no webhook configured" });
    }

    await postSlackWebhook(url, message.text, message.blocks);

    await logCronRun({
      job: "deals-digest",
      status: "success",
      rows_upserted: null,
      error: null
    });
    return NextResponse.json({ ok: true, metrics: digest.metrics });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!dryRun) {
      await logCronRun({
        job: "deals-digest",
        status: "error",
        rows_upserted: null,
        error: msg
      });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
