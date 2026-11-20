import "dotenv/config";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/deals-digest/route";
import { getLatestCronRunForJob } from "@/lib/db/cron_runs";
import { countLeads, listLeads } from "@/lib/db/leads";
import { computeDealMetrics } from "@/lib/deals/dealGroups";
import {
  buildDealsDigestMessage,
  dealsDigestWebhookUrl,
  gatherDealsDigest,
  openDealsListFilters
} from "@/lib/deals/dealsDigest";
import { findOrgIdBySlug } from "@/lib/orgs/getOrgIdBySlug";

const hasDb =
  process.env.LIVE_DB === "1" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function rmaOrgId(): Promise<string> {
  return (
    (await findOrgIdBySlug("rma")) ??
    (await findOrgIdBySlug("rma-marketing")) ??
    ""
  );
}

describe.skipIf(!hasDb)("deals digest live vs Deals tiles", () => {
  it("logs the built message and matches Open-tab tile counts", async () => {
    const orgId = await rmaOrgId();
    expect(orgId).toBeTruthy();
    const asOf = new Date();
    const digest = await gatherDealsDigest(orgId, asOf);
    const rows = await listLeads(openDealsListFilters(orgId));
    const tiles = computeDealMetrics(rows, [], asOf);
    const [sqlOverdue, sqlToday, sqlNeeds] = await Promise.all([
      countLeads({
        orgId,
        showedOnly: true,
        dealStatus: "open",
        dealMetric: "overdue"
      }),
      countLeads({
        orgId,
        showedOnly: true,
        dealStatus: "open",
        dealMetric: "today"
      }),
      countLeads({
        orgId,
        showedOnly: true,
        dealStatus: "open",
        dealMetric: "needs_next_step"
      })
    ]);
    const message = buildDealsDigestMessage(digest);
    console.log(
      JSON.stringify(
        {
          asOf: asOf.toISOString(),
          digest: digest.metrics,
          tiles: {
            overdue: tiles.overdue,
            dueToday: tiles.dueToday,
            needsNextStep: tiles.needsNextStep
          },
          sql: { overdue: sqlOverdue, today: sqlToday, needs: sqlNeeds },
          text: message.text,
          blocks: message.blocks
        },
        null,
        2
      )
    );
    expect(digest.metrics.overdue).toBe(tiles.overdue);
    expect(digest.metrics.dueToday).toBe(tiles.dueToday);
    expect(digest.metrics.needsNextStep).toBe(tiles.needsNextStep);
    expect(digest.metrics.overdue).toBe(sqlOverdue);
    expect(digest.metrics.dueToday).toBe(sqlToday);
  });
});

const canPost =
  hasDb &&
  process.env.POST_DEALS_DIGEST === "1" &&
  Boolean(process.env.CRON_SECRET) &&
  Boolean(dealsDigestWebhookUrl());

describe.skipIf(!canPost)("deals digest one-off Slack post", () => {
  it("posts once through the cron route and logs cron_runs", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/cron/deals-digest", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.skipped).not.toBe(true);
    const run = await getLatestCronRunForJob("deals-digest");
    expect(run?.status).toBe("success");
    console.log(
      JSON.stringify({
        posted: true,
        metrics: body.metrics,
        cron_runs: run ? { status: run.status, ran_at: run.ran_at } : null
      })
    );
  });
});
