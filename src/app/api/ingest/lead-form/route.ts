import { NextRequest, NextResponse } from "next/server";
import { getLeadByEmail, insertLead, updateLead } from "@/lib/db/leads";
import type { LeadRow } from "@/lib/leads/types";
import {
  mergeCustomFields,
  resolveWebsiteFieldValue,
  WEBSITE_CANONICAL_CUSTOM_FIELD_KEYS
} from "@/lib/leads/customFields";
import { normalizePhoneInput } from "@/lib/leads/contactNormalize";
import { getOrgIdBySlug } from "@/lib/orgs/getOrgIdBySlug";
import { notifySlackNewLead } from "@/lib/slack/messages";
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
  form_answers?: unknown;
  qualified?: unknown;
  /** Legacy short keys and/or canonical long keys may appear at the top level. */
  [key: string]: unknown;
};

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  return null;
}

function optionalBool(v: unknown): boolean | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "boolean") return v;
  return undefined;
}

/**
 * Website qual answers always land under Quickform's canonical long keys
 * in custom_fields. Accepts legacy short names from the form payload.
 * Never writes the four legacy strict columns (describes_you, etc.).
 */
function customFieldsFromWebsiteBody(
  body: LeadFormBody
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const formAnswers =
    body.form_answers &&
    typeof body.form_answers === "object" &&
    !Array.isArray(body.form_answers)
      ? (body.form_answers as Record<string, unknown>)
      : null;

  for (const canonical of WEBSITE_CANONICAL_CUSTOM_FIELD_KEYS) {
    const value = resolveWebsiteFieldValue([body, formAnswers], canonical);
    if (value) out[canonical] = value;
  }

  return out;
}

async function maybeNotifyNewLead(
  existing: LeadRow | null,
  lead: LeadRow
): Promise<LeadRow> {
  if (existing?.slack_form_notified) return lead;
  await notifySlackNewLead(lead);
  return updateLead(lead, { slack_form_notified: true });
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
  const incomingCustom = customFieldsFromWebsiteBody(body);

  const patch: Partial<LeadRow> = {
    name: str(body.name),
    phone: normalizePhoneInput(str(body.phone)),
    utm_source: str(body.utm_source),
    utm_medium: str(body.utm_medium),
    utm_campaign: str(body.utm_campaign),
    utm_content: str(body.utm_content),
    utm_term: str(body.utm_term),
    ad_set_id: str(body.ad_set_id),
    lead_source: str(body.lead_source)
  };

  try {
    // Deliberate simplification: only RMA's website hits this endpoint today.
    // Per-org ingest routing comes later when a second org has its own site.
    const orgId = await getOrgIdBySlug("rma");

    const existing = await getLeadByEmail(email, orgId);
    if (!existing) {
      let created = await insertLead({
        org_id: orgId,
        email,
        ...patch,
        custom_fields: mergeCustomFields({}, incomingCustom),
        form_filled_at: now,
        qualified: qualified === undefined ? null : qualified,
        qualified_at: qualified === true || qualified === false ? now : null,
        qualified_by: qualified === true || qualified === false ? "form" : null
      });
      created = await maybeNotifyNewLead(null, created);
      return NextResponse.json({
        id: created.id,
        stage: created.stage,
        created: true
      });
    }

    const nextQualified =
      qualified === undefined ? existing.qualified : qualified;

    let updated = await updateLead(existing, {
      ...Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== null)
      ),
      custom_fields: mergeCustomFields(existing.custom_fields, incomingCustom),
      form_filled_at: existing.form_filled_at ?? now,
      qualified: nextQualified,
      qualified_by:
        qualified === true || qualified === false
          ? "form"
          : existing.qualified_by
    });

    updated = await maybeNotifyNewLead(existing, updated);

    return NextResponse.json({
      id: updated.id,
      stage: updated.stage,
      created: false
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
