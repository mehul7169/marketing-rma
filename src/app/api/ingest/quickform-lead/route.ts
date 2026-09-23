import { NextRequest, NextResponse } from "next/server";
import {
  getLeadByPhone,
  sheetFieldsForLeadUpdate,
  updateLead,
  upsertLeadByOrgEmail,
  type LeadSheetUpsertFields
} from "@/lib/db/leads";
import type { LeadRow } from "@/lib/leads/types";
import { findOrgIdBySlug } from "@/lib/orgs/getOrgIdBySlug";
import { normalizePhoneInput } from "@/lib/leads/contactNormalize";
import { formatUnknownError } from "@/lib/utils/formatUnknownError";
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
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
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
    /\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/
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

/**
 * Initial workflow hints from sheet STATUS — applied only when the lead is new
 * (or the relevant field is still empty). Never used to overwrite CRM progress.
 */
function insertOnlyStatusPatch(
  lead: LeadRow,
  leadStatus: string | null,
  bookingDetails: string | null,
  now: string
): Partial<LeadRow> | null {
  const statusLower = (leadStatus ?? "").toLowerCase();
  const isReject = statusLower.includes("reject");
  const isCallBooked = statusLower.includes("call booked");
  const patch: Partial<LeadRow> = {};

  if (isReject) {
    if (lead.qualified == null) {
      patch.qualified = false;
      patch.qualified_by = "quickform";
      patch.qualified_at = now;
    }
  } else if (isCallBooked) {
    if (!lead.call_booked_at) {
      patch.call_booked_at = now;
    }
    const scheduled = parseBookingDetails(bookingDetails);
    if (scheduled && !lead.call_scheduled_for) {
      patch.call_scheduled_for = scheduled;
    }
  }

  return Object.keys(patch).length ? patch : null;
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
    console.error(
      "[quickform-lead] missing org_slug — acknowledging without write"
    );
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
    console.error(
      `[quickform-lead] org lookup failed for slug="${orgSlug}": ${formatUnknownError(e)}`
    );
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
  const phone = normalizePhoneInput(fieldStr(fields, "phone_number", "phone"));
  const name = fieldStr(fields, "full_name", "name");
  const metaLeadId = fieldStr(fields, "id");
  const adSetId = fieldStr(fields, "adset_id", "ad_set_id");
  const campaignName = fieldStr(fields, "campaign_name", "utm_campaign");
  const adName = fieldStr(fields, "ad_name", "utm_content");
  const adsetName = fieldStr(fields, "adset_name", "utm_term");
  const utmSource = fieldStr(fields, "utm_source");
  const utmMedium = fieldStr(fields, "utm_medium");
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

  const now = new Date().toISOString();
  const filledAt =
    (createdTime && Number.isFinite(Date.parse(createdTime))
      ? new Date(createdTime).toISOString()
      : null) ?? now;

  const sheet: LeadSheetUpsertFields = {
    name,
    phone,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: campaignName,
    utm_content: adName,
    utm_term: adsetName,
    ad_set_id: adSetId,
    ghl_contact_id: metaLeadId,
    lead_source: leadSourceFromPlatform(platform),
    custom_fields: incomingCustom,
    form_filled_at: filledAt
  };

  try {
    // Phone-only match within org (no email, or email not used for match yet).
    // Email path uses true upsert on (org_id, email) below.
    if (!email && phone) {
      const byPhone = await getLeadByPhone(phone, orgId);
      if (byPhone) {
        const updated = await updateLead(
          byPhone,
          sheetFieldsForLeadUpdate(byPhone, sheet)
        );
        return NextResponse.json({
          ok: true,
          action: "updated",
          id: updated.id,
          matched_by: "phone",
          stage: updated.stage,
          warnings: [] as string[]
        });
      }

      const insertEmail = placeholderEmailFromPhone(phone);
      const { lead: created, action } = await upsertLeadByOrgEmail(
        orgId,
        insertEmail,
        sheet
      );
      const statusPatch = insertOnlyStatusPatch(
        created,
        leadStatus,
        bookingDetails,
        now
      );
      const finalLead = statusPatch
        ? await updateLead(created, statusPatch)
        : created;

      return NextResponse.json({
        ok: true,
        action,
        id: finalLead.id,
        matched_by: null,
        stage: finalLead.stage,
        warnings: [] as string[]
      });
    }

    const upsertEmail = email ?? placeholderEmailFromPhone(phone!);
    const { lead, action } = await upsertLeadByOrgEmail(orgId, upsertEmail, sheet);

    // Sheet STATUS may seed workflow fields on first ingest only (never overwrite).
    const statusPatch =
      action === "created"
        ? insertOnlyStatusPatch(lead, leadStatus, bookingDetails, now)
        : null;
    const finalLead = statusPatch ? await updateLead(lead, statusPatch) : lead;

    return NextResponse.json({
      ok: true,
      action,
      id: finalLead.id,
      matched_by: action === "updated" ? "email" : null,
      stage: finalLead.stage,
      warnings: [] as string[]
    });
  } catch (e) {
    const msg = formatUnknownError(e);
    console.error(`[quickform-lead] error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
