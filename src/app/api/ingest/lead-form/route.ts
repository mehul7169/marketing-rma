import { NextRequest, NextResponse } from "next/server";
import { getLeadByEmail, insertLead, updateLead } from "@/lib/db/leads";
import type { LeadRow } from "@/lib/leads/types";
import { assertWebsiteIngestSecret } from "@/lib/utils/ingestAuth";

export const runtime = "nodejs";

type LeadFormBody = {
  email?: unknown;
  name?: unknown;
  phone?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  utm_term?: unknown;
  ad_set_id?: unknown;
  lead_source?: unknown;
  describes_you?: unknown;
  biggest_goal?: unknown;
  monthly_revenue?: unknown;
  investment_capacity?: unknown;
  form_answers?: unknown;
  qualified?: unknown;
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function optionalBool(v: unknown): boolean | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "boolean") return v;
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    assertWebsiteIngestSecret(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: LeadFormBody;
  try {
    body = (await req.json()) as LeadFormBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = str(body.email)?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const qualified = optionalBool(body.qualified);
  const formAnswers =
    body.form_answers && typeof body.form_answers === "object" && !Array.isArray(body.form_answers)
      ? (body.form_answers as Record<string, unknown>)
      : null;

  const patch: Partial<LeadRow> = {
    name: str(body.name),
    phone: str(body.phone),
    utm_source: str(body.utm_source),
    utm_medium: str(body.utm_medium),
    utm_campaign: str(body.utm_campaign),
    utm_content: str(body.utm_content),
    utm_term: str(body.utm_term),
    ad_set_id: str(body.ad_set_id),
    lead_source: str(body.lead_source),
    describes_you: str(body.describes_you),
    biggest_goal: str(body.biggest_goal),
    monthly_revenue: str(body.monthly_revenue),
    investment_capacity: str(body.investment_capacity),
    form_answers: formAnswers
  };

  try {
    const existing = await getLeadByEmail(email);
    if (!existing) {
      const created = await insertLead({
        email,
        ...patch,
        form_filled_at: now,
        qualified: qualified === undefined ? null : qualified,
        qualified_at: qualified === true || qualified === false ? now : null,
        qualified_by: qualified === true || qualified === false ? "form" : null
      });
      return NextResponse.json({ id: created.id, stage: created.stage, created: true });
    }

    const nextQualified =
      qualified === undefined ? existing.qualified : qualified;

    const updated = await updateLead(existing, {
      ...Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== null)
      ),
      form_filled_at: existing.form_filled_at ?? now,
      form_answers: formAnswers ?? existing.form_answers,
      qualified: nextQualified,
      qualified_by:
        qualified === true || qualified === false
          ? "form"
          : existing.qualified_by
    });

    return NextResponse.json({ id: updated.id, stage: updated.stage, created: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
