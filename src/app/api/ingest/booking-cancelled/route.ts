import { NextRequest, NextResponse } from "next/server";
import { getLeadByEmail, updateLead } from "@/lib/db/leads";
import { assertWebsiteIngestSecret } from "@/lib/utils/ingestAuth";

export const runtime = "nodejs";

type CancelBody = {
  email?: unknown;
  cal_com_booking_id?: unknown;
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export async function POST(req: NextRequest) {
  try {
    assertWebsiteIngestSecret(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CancelBody;
  try {
    body = (await req.json()) as CancelBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = str(body.email)?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  try {
    const existing = await getLeadByEmail(email);
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const updated = await updateLead(existing, {
      call_cancelled_at: new Date().toISOString()
    });

    return NextResponse.json({ id: updated.id, stage: updated.stage });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
