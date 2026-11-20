import { describe, expect, it } from "vitest";
import {
  isMetaAdsDataStale,
  metaAdsHealthBannerText,
  type MetaAdsHealth
} from "@/lib/cron/metaAdsHealth";

describe("isMetaAdsDataStale", () => {
  it("is stale when the last day is more than 2 IST days behind today", () => {
    expect(isMetaAdsDataStale("2026-11-18", "2026-11-20")).toBe(false);
    expect(isMetaAdsDataStale("2026-11-17", "2026-11-20")).toBe(true);
    expect(isMetaAdsDataStale("2026-10-11", "2026-11-20")).toBe(true);
    expect(isMetaAdsDataStale(null, "2026-11-20")).toBe(true);
  });
});

describe("metaAdsHealthBannerText", () => {
  const failing: MetaAdsHealth = {
    failing: true,
    failingSince: "2026-10-11T02:30:00.000Z",
    lastError: "Error validating access token: Session has expired",
    stale: true,
    lastDataDate: "2026-10-11"
  };

  it("uses the token copy while the job is failing", () => {
    expect(metaAdsHealthBannerText(failing)).toBe(
      "Meta Ads sync has been failing since 11 Oct. Meta access token expired. Reconnect with a long-lived token."
    );
  });

  it("hides when healthy and fresh", () => {
    expect(
      metaAdsHealthBannerText({
        failing: false,
        failingSince: null,
        lastError: null,
        stale: false,
        lastDataDate: "2026-11-20"
      })
    ).toBeNull();
  });

  it("mentions frozen spend when only data is stale", () => {
    expect(
      metaAdsHealthBannerText({
        failing: false,
        failingSince: null,
        lastError: null,
        stale: true,
        lastDataDate: "2026-10-11"
      })
    ).toContain("last day 2026-10-11");
  });
});
