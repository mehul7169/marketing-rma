import { NextRequest, NextResponse } from "next/server";
import {
  getLeadByEmail,
  getLeadByPhone,
  insertLead,
  updateLead
} from "@/lib/db/leads";
import type { LeadRow } from "@/lib/leads/types";
import { mergeCustomFields } from "@/lib/leads/customFields";
import { findOrgIdBySlug } from "@/lib/orgs/getOrgIdBySlug";
import { assertQuickformIngestSecret } from "@/lib/utils/ingestAuth";

export const runtime = "nodejs";

type QuickformBody = {
  org_slug?: unknown;
  fields?: unknown;
};

/** Sheet headers consumed into structural lead columns (excluded from custom_fields). */
const STRUCTURAL_FIELD_KEYS = new Set([
  "email",
  "phone_number",
  "phone",
  "full_name",
  "name",
  "adset_id",
  "ad_set_id",
  "campaign_name",
  "ad_name",
  "adset_name",
  "lead_status",
  "id"
]);

function fieldStr(fields: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    if (!(key in fields)) continue;
    const v = fields[key];
    if (v === null || v === undefined) continue;
    const t = String(v).trim();
    if (t.length) return t;
  }
  return null;
}

function parseBookingDetails(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(
    /\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/
  );
  const candidate = isoMatch?.[0] ?? trimmed;
  const ms = Date.parse(candidate);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function placeholderEmailFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "") || "unknown";
  return `qf-phone-${digits}@quickform.invalid`;
}

function leadSourceFromPlatform(platform: string | null): string {
  if (!platform) return "quickform";
  const slug = platform
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `quickform_${slug}` : "quickform";
}

function customFieldsFromSheet(
  fields: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (STRUCTURAL_FIELD_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    assertQuickformIngestSecret(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: QuickformBody;
  try {
    body = (await req.json()) as QuickformBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orgSlug =
    typeof body.org_slug === "string" ? body.org_slug.trim().toLowerCase() : "";
  if (!orgSlug) {
    console.error("[quickform-lead] missing org_slug — acknowledging without write");
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "missing_org_slug"
    });
  }

  let orgId: string | null;
  try {
    orgId = await findOrgIdBySlug(orgSlug);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[quickform-lead] org lookup failed for slug="${orgSlug}": ${msg}`);
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "org_lookup_error"
    });
  }

  if (!orgId) {
    console.error(
      `[quickform-lead] unknown org_slug="${orgSlug}" — acknowledging without write (check Apps Script config)`
    );
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "unknown_org_slug",
      org_slug: orgSlug
    });
  }

  if (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) {
    return NextResponse.json({ error: "fields object is required" }, { status: 400 });
  }

  const fields = body.fields as Record<string, unknown>;
  const email = fieldStr(fields, "email")?.toLowerCase() ?? null;
  const phone = fieldStr(fields, "phone_number", "phone");
  const name = fieldStr(fields, "full_name", "name");
  const metaLeadId = fieldStr(fields, "id");
  const adSetId = fieldStr(fields, "adset_id", "ad_set_id");
  const campaignName = fieldStr(fields, "campaign_name");
  const adName = fieldStr(fields, "ad_name");
  const adsetName = fieldStr(fields, "adset_name");
  const leadStatus = fieldStr(fields, "lead_status");
  const bookingDetails = fieldStr(fields, "Booking details");
  const platform = fieldStr(fields, "platform");
  const createdTime = fieldStr(fields, "created_time");
  const incomingCustom = customFieldsFromSheet(fields);

  if (!email && !phone) {
    return NextResponse.json(
      { error: "email or phone_number is required" },
      { status: 400 }
    );
  }

  try {
    let existing: LeadRow | null = null;
    let matchedBy: "email" | "phone" | null = null;

    if (email) {
      existing = await getLeadByEmail(email, orgId);
      if (existing) matchedBy = "email";
    }
    if (!existing && phone) {
      existing = await getLeadByPhone(phone, orgId);
      if (existing) matchedBy = "phone";
    }

    const now = new Date().toISOString();

    const basePatch: Partial<LeadRow> = {
      name,
      phone,
      ad_set_id: adSetId,
      utm_campaign: campaignName,
      utm_content: adName,
      utm_term: adsetName,
      ghl_contact_id: metaLeadId,
      lead_source: leadSourceFromPlatform(platform),
      custom_fields: mergeCustomFields(existing?.custom_fields, incomingCustom)
    };

    const statusLower = (leadStatus ?? "").toLowerCase();
    const isReject = statusLower.includes("reject");
    const isCallBooked = statusLower.includes("call booked");

    const statusPatch: Partial<LeadRow> = {};
    const warnings: string[] = [];

    if (isReject) {
      if (existing?.qualified === true) {
        warnings.push(
          "lead_status indicates Reject but lead is already qualified=true — not flipping qualified back to false"
        );
        console.warn(
          `[quickform-lead] refuse to un-qualify lead ${existing.id} (status="${leadStatus}")`
        );
      } else if (existing?.qualified !== false) {
        statusPatch.qualified = false;
        statusPatch.qualified_by = "quickform";
      }
    } else if (isCallBooked) {
      if (!existing?.call_booked_at) {
        statusPatch.call_booked_at = now;
      }
      const scheduled = parseBookingDetails(bookingDetails);
      if (scheduled && !existing?.call_scheduled_for) {
        statusPatch.call_scheduled_for = scheduled;
      }
    }

    const filledAt =
      (createdTime && Number.isFinite(Date.parse(createdTime))
        ? new Date(createdTime).toISOString()
        : null) ?? now;

    if (!existing) {
      const insertEmail = email ?? placeholderEmailFromPhone(phone!);
      const created = await insertLead({
        org_id: orgId,
        email: insertEmail,
        ...Object.fromEntries(
          Object.entries(basePatch).filter(([, v]) => v !== null && v !== undefined)
        ),
        ...statusPatch,
        form_filled_at: filledAt,
        qualified_at: statusPatch.qualified === false ? now : null
      });

      return NextResponse.json({
        ok: true,
        action: "created",
        id: created.id,
        matched_by: null,
        stage: created.stage,
        warnings
      });
    }

    const updatePayload: Partial<LeadRow> = {
      ...Object.fromEntries(
        Object.entries(basePatch).filter(([, v]) => v !== null && v !== undefined)
      ),
      ...statusPatch,
      form_filled_at: existing.form_filled_at ?? filledAt
    };

    const updated = await updateLead(existing, updatePayload);

    return NextResponse.json({
      ok: true,
      action: "updated",
      id: updated.id,
      matched_by: matchedBy,
      stage: updated.stage,
      warnings
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[quickform-lead] error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
