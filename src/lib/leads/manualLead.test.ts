import { describe, expect, it } from "vitest";
import { isSyntheticQuickformEmail } from "@/lib/leads/contactNormalize";
import { isQuickformSource } from "@/lib/leads/actionStatus";
import { phoneDigitsMatch } from "@/lib/db/leads";
import { MANUAL_LEAD_SOURCES, validateManualLead } from "@/lib/leads/manualLead";
import { resolveCreativeMatch, type KnownAdsIndex } from "@/lib/insights/metrics";
import { makeLead } from "@/test/fixtures";

const base = { name: "A", phone: "+919876543210", email: "", source: "manual", notes: "" };

describe("validateManualLead", () => {
  it("uses a synthetic placeholder email when email is blank", () => {
    const res = validateManualLead(base);
    expect(res.ok && res.lead.email).toBe("manual-phone-919876543210@manual.invalid");
    expect(res.ok && isSyntheticQuickformEmail(res.lead.email)).toBe(true);
  });

  it("keeps a real email lowercased", () => {
    const res = validateManualLead({ ...base, email: " X@Y.com " });
    expect(res.ok && res.lead.email).toBe("x@y.com");
  });

  it("rejects short phones, bad email, and ingest source values", () => {
    const res = validateManualLead({
      ...base,
      phone: "12345",
      email: "nope",
      source: "quickform_ig"
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(Object.keys(res.errors).sort()).toEqual(["email", "phone", "source"]);
  });

  it("manual sources never look like ingest sources", () => {
    const ingest = ["facebook", "ig", "youtube", "youtubemokshvideo", "meta"];
    for (const { value } of MANUAL_LEAD_SOURCES) {
      expect(isQuickformSource(value)).toBe(false);
      expect(ingest).not.toContain(value);
    }
  });
});

describe("manual leads are never ad-attributed", () => {
  it("does not match any known Meta ad (counts as unmatched, like other non-Meta leads)", () => {
    const res = validateManualLead({ ...base, source: "referral" });
    if (!res.ok) throw new Error("expected valid");
    const lead = makeLead({ ...res.lead, utm_content: null });
    const known: KnownAdsIndex = {
      byAdId: new Map([["123", "Ad A"]]),
      byAdName: new Map([["referral", { adId: "123", adName: "referral" }]])
    };
    expect(resolveCreativeMatch(lead.utm_content, known)).toBeNull();
  });
});

describe("phoneDigitsMatch", () => {
  it("matches across +91 / p: prefixes", () => {
    expect(phoneDigitsMatch("p:+919876543210", "9876543210")).toBe(true);
    expect(phoneDigitsMatch("+919876543210", "919876543210")).toBe(true);
  });

  it("ignores short stored values that would match anything", () => {
    expect(phoneDigitsMatch("10", "919876543210")).toBe(false);
  });
});
