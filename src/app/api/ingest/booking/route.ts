import { NextRequest, NextResponse } from "next/server";
import { getLeadByEmail, insertLead, updateLead } from "@/lib/db/leads";
import type { LeadRow } from "@/lib/leads/types";
import { notifySlackCallBooked } from "@/lib/slack/messages";
import { assertWebsiteIngestSecret } from "@/lib/utils/ingestAuth";

export const runtime = "nodejs";

type BookingBody = {
  email?: unknown;
  cal_com_booking_id?: unknown;
  call_scheduled_for?: unknown;
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

async function maybeNotifyBooking(
  hadBooking: boolean,
  hadNotified: boolean,
  lead: LeadRow
): Promise<LeadRow> {
  if (hadBooking || hadNotified) return lead;
  await notifySlackCallBooked(lead);
  return updateLead(lead, { slack_booking_notified: true });
}

export async function POST(req: NextRequest) {
  try {
    assertWebsiteIngestSecret(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BookingBody;
  try {
    body = (await req.json()) as BookingBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = str(body.email)?.toLowerCase();
  const calComBookingId = str(body.cal_com_booking_id);
  const callScheduledFor = str(body.call_scheduled_for);

  if (!email || !calComBookingId || !callScheduledFor) {
    return NextResponse.json(
      { error: "email, cal_com_booking_id, and call_scheduled_for are required" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  try {
    const existing = await getLeadByEmail(email);
    if (!existing) {
      let created = await insertLead({
        email,
        call_booked_at: now,
        call_scheduled_for: callScheduledFor,
        cal_com_booking_id: calComBookingId,
        booking_source: "cal_com",
        call_cancelled_at: null
      });
      created = await maybeNotifyBooking(false, false, created);
      return NextResponse.json({
        id: created.id,
        stage: created.stage,
        created: true,
        unusual: true,
        note: "Booking received with no prior form submission — lead row was created."
      });
    }

    const hadBooking = Boolean(existing.call_booked_at);
    const hadNotified = existing.slack_booking_notified;

    let updated = await updateLead(existing, {
      call_booked_at: existing.call_booked_at ?? now,
      call_scheduled_for: callScheduledFor,
      cal_com_booking_id: calComBookingId,
      booking_source: "cal_com",
      call_cancelled_at: null
    });

    updated = await maybeNotifyBooking(hadBooking, hadNotified, updated);

    return NextResponse.json({
      id: updated.id,
      stage: updated.stage,
      created: false,
      unusual: false
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
