import { NextRequest, NextResponse } from "next/server";
import { isPlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import { getAdAccountById } from "@/lib/db/ad_accounts";
import {
  backfillCronJobName,
  getLatestCronRunForJob
} from "@/lib/db/cron_runs";
import { countMetaAdsRowsForAccount } from "@/lib/db/meta_ads_daily";

export const runtime = "nodejs";

const PENDING_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

export async function GET(req: NextRequest) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const account = await getAdAccountById(id);
  if (!account || account.is_lead_source) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const [cron, rowCount] = await Promise.all([
    getLatestCronRunForJob(backfillCronJobName(id)),
    countMetaAdsRowsForAccount(id)
  ]);

  if (cron?.status === "error") {
    return NextResponse.json({
      status: "error" as const,
      error: cron.error ?? "Backfill failed",
      rows: rowCount
    });
  }

  if (cron?.status === "success" || rowCount > 0) {
    return NextResponse.json({
      status: "complete" as const,
      rows: rowCount
    });
  }

  const createdAt = Date.parse(account.created_at);
  const young =
    Number.isFinite(createdAt) && Date.now() - createdAt < PENDING_WINDOW_MS;

  if (young) {
    return NextResponse.json({
      status: "pending" as const,
      rows: 0
    });
  }

  return NextResponse.json({
    status: "complete" as const,
    rows: 0
  });
}
