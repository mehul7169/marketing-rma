import {
  manualPlaceholderEmail,
  normalizePhoneInput
} from "@/lib/leads/contactNormalize";

/**
 * lead_source values for hand-entered leads. Deliberately disjoint from ingest
 * values (quickform_*, facebook, ig, youtube…) so nothing reads them as ad-attributed.
 */
export const MANUAL_LEAD_SOURCES = [
  { value: "referral", label: "Referral" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" }
] as const;

export type ManualLeadSource = (typeof MANUAL_LEAD_SOURCES)[number]["value"];

export type ManualLeadInput = {
  name: string;
  phone: string;
  email?: string | null;
  source: string;
  notes?: string | null;
};

export type ManualLeadFieldErrors = Partial<
  Record<"name" | "phone" | "email" | "source", string>
>;

export type NormalizedManualLead = {
  name: string;
  phone: string;
  email: string;
  lead_source: ManualLeadSource;
  notes: string | null;
};

/** Same digit floor the phone matcher uses (getLeadByPhone). */
const MIN_PHONE_DIGITS = 7;

export function validateManualLead(
  input: ManualLeadInput
): { ok: true; lead: NormalizedManualLead } | { ok: false; errors: ManualLeadFieldErrors } {
  const errors: ManualLeadFieldErrors = {};
  const name = input.name?.trim() ?? "";
  if (!name) errors.name = "Name is required.";

  const phone = normalizePhoneInput(input.phone);
  if (!phone) {
    errors.phone = "Phone is required.";
  } else if (phone.replace(/\D/g, "").length < MIN_PHONE_DIGITS) {
    errors.phone = `Phone must have at least ${MIN_PHONE_DIGITS} digits.`;
  }

  const rawEmail = input.email?.trim().toLowerCase() ?? "";
  if (rawEmail && !/^[^\s@]+@[^\s@]+$/.test(rawEmail)) {
    errors.email = "Enter a valid email or leave it blank.";
  }

  const source = MANUAL_LEAD_SOURCES.find((s) => s.value === input.source)?.value;
  if (!source) errors.source = "Pick a source.";

  if (Object.keys(errors).length > 0 || !phone || !source) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    lead: {
      name,
      phone,
      email: rawEmail || manualPlaceholderEmail(phone),
      lead_source: source,
      notes: input.notes?.trim() || null
    }
  };
}
