import { NextRequest, NextResponse } from "next/server";
import {
  listLeadsNeedingSlackNoBookingNudge,
  markSlackNoBookingNotified,
} from "@/lib/db/leads";
import { notifySlackNoBookingYet } from "@/lib/slack/messages";
import { assertCronSecret } from "@/lib/utils/cronAuth";

export const runtime = "nodejs";

/** Minutes after form fill before nudging BD about a qualified lead with no booking. */
const SLACK_FOLLOWUP_DELAY_MINUTES = Number(
  process.env.SLACK_FOLLOWUP_DELAY_MINUTES ?? "5",
);

export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const leads = await listLeadsNeedingSlackNoBookingNudge(
      SLACK_FOLLOWUP_DELAY_MINUTES,
    );
    let notified = 0;

    for (const lead of leads) {
      await notifySlackNoBookingYet(lead, SLACK_FOLLOWUP_DELAY_MINUTES);
      await markSlackNoBookingNotified(lead.id);
      notified += 1;
    }

    return NextResponse.json({ ok: true, checked: leads.length, notified });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
