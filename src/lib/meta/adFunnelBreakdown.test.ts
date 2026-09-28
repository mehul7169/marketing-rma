import { describe, expect, it } from "vitest";
import type { MetaAdNode, MetaCampaignNode } from "@/lib/db/meta_ads_daily";
import type { KnownAdsIndex } from "@/lib/insights/metrics";
import { makeLead } from "@/test/fixtures";
import { buildAdFunnelBreakdown, costPer } from "@/lib/meta/adFunnelBreakdown";
import { attachMetaFunnelOutcomes } from "@/lib/meta/funnelOutcomes";
import { transformMetaInsightsRows, type MetaInsightsRow } from "@/lib/ingest/meta";

function ad(ad_id: string, ad_name: string, spend: number, lpv = 0): MetaAdNode {
  return {
    ad_id,
    ad_name,
    creative_thumbnail_url: null,
    spend,
    landing_page_views: lpv
  } as MetaAdNode;
}

function hierarchy(ads: MetaAdNode[]): MetaCampaignNode[] {
  const spend = ads.reduce((s, a) => s + a.spend, 0);
  return [
    {
      campaign_id: "c1",
      campaign_name: "Campaign",
      spend,
      ad_sets: [{ ad_set_id: "s1", ad_set_name: "Set", spend, ads }]
    } as unknown as MetaCampaignNode
  ];
}

const known: KnownAdsIndex = {
  byAdId: new Map([
    ["lp-ad", "LP Ad"],
    ["qf-ad", "QF Ad"],
    ["idle-ad", "Idle Ad"]
  ]),
  byAdName: new Map([
    ["lp ad", { adId: "lp-ad", adName: "LP Ad" }],
    ["qf ad", { adId: "qf-ad", adName: "QF Ad" }],
    ["idle ad", { adId: "idle-ad", adName: "Idle Ad" }]
  ])
};

const IN = "2026-09-10T06:00:00.000Z";
const OUT = "2026-08-01T06:00:00.000Z";

describe("buildAdFunnelBreakdown", () => {
  const campaigns = () =>
    hierarchy([ad("lp-ad", "LP Ad", 1000, 50), ad("qf-ad", "QF Ad", 600, 7), ad("idle-ad", "Idle Ad", 100, 9)]);

  const leads = [
    // Landing page: form-qualified, booked, confirmed, showed.
    makeLead({ id: "a", lead_source: "facebook", utm_content: "LP Ad", created_at: IN, qualified: true, qualified_by: "form", call_booked_at: IN, call_confirmed: true, call_showed: true }),
    // Admin-qualified: an opt-in and booking, but not a form-qualified opt-in.
    makeLead({ id: "b", lead_source: "facebook", utm_content: "lp-ad", created_at: IN, qualified: true, qualified_by: "admin@x.com", call_booked_at: IN }),
    // Progressed past QCB (stage closed) — still counted via call_confirmed.
    makeLead({ id: "c", lead_source: "facebook", utm_content: "LP Ad", created_at: IN, stage: "closed", call_booked_at: IN, call_confirmed: true }),
    // Outside range — classifies but not counted.
    makeLead({ id: "d", lead_source: "facebook", utm_content: "LP Ad", created_at: OUT, qualified: true, qualified_by: "form" }),
    makeLead({ id: "e", lead_source: "quickform_ig", utm_content: "QF Ad", created_at: IN, call_booked_at: IN, call_confirmed: true, call_showed: true }),
    makeLead({ id: "f", lead_source: "quickform_fb", utm_content: "QF Ad", created_at: IN, call_confirmed: true }),
    // ig leads are in neither bucket, even when attributed to an ad.
    makeLead({ id: "g", lead_source: "ig", utm_content: "Idle Ad", created_at: IN, call_confirmed: true, call_showed: true })
  ];

  it("counts landing-page metrics per ad with the cohort QCB definition", () => {
    const [campaign] = buildAdFunnelBreakdown(campaigns(), leads, known, "2026-09-01", "2026-09-30");
    const [lp, qf, idle] = campaign!.ad_sets[0]!.ads;

    expect(lp).toMatchObject({
      classification: "landing_page",
      landingPageViews: 50,
      optIns: 3,
      qualifiedOptIns: 1,
      callsBooked: 3,
      qualifiedCallsBooked: 2,
      qualifiedShowups: 1
    });
    expect(qf).toMatchObject({
      classification: "quickform",
      landingPageViews: null,
      optIns: null,
      qualifiedOptIns: null,
      callsBooked: null,
      qualifiedCallsBooked: null,
      qualifiedShowups: 1
    });
    expect(idle).toMatchObject({ classification: null, landingPageViews: null, qualifiedShowups: null });
  });

  it("rolls up only applicable children and keeps row-level spend", () => {
    const [campaign] = buildAdFunnelBreakdown(campaigns(), leads, known, "2026-09-01", "2026-09-30");
    expect(campaign).toMatchObject({
      spend: 1700,
      classification: "mixed",
      landingPageViews: 50,
      optIns: 3,
      qualifiedShowups: 2
    });
  });

  it("classifies only the ad a name-matched lead resolves to, not every same-named ad", () => {
    const tree = hierarchy([ad("lp-ad", "LP Ad", 1000, 50), ad("lp-ad-copy", "LP Ad", 200, 5)]);
    const [campaign] = buildAdFunnelBreakdown(tree, leads, known, "2026-09-01", "2026-09-30");
    const [main, copy] = campaign!.ad_sets[0]!.ads;
    expect(main!.classification).toBe("landing_page");
    expect(copy!.classification).toBeNull();
    expect(copy!.landingPageViews).toBeNull();
  });

  it("keeps an LP ad with no in-range leads at 0, not n/a", () => {
    const [campaign] = buildAdFunnelBreakdown(campaigns(), leads, known, "2026-07-01", "2026-07-31");
    const lp = campaign!.ad_sets[0]!.ads[0]!;
    expect(lp.classification).toBe("landing_page");
    expect(lp.optIns).toBe(0);
    expect(costPer(lp.spend, lp.optIns)).toBeNull();
  });
});

describe("costPer", () => {
  it("divides spend by count", () => expect(costPer(1000, 4)).toBe(250));
  it("is null for zero or n/a", () => {
    expect(costPer(1000, 0)).toBeNull();
    expect(costPer(1000, null)).toBeNull();
  });
});

describe("attachMetaFunnelOutcomes (after resolver extraction)", () => {
  it("still attributes by id/name and counts unknown utm_content as unmatched", () => {
    const tree = hierarchy([ad("lp-ad", "LP Ad", 10)]);
    const { campaigns, unmatchedLeadCount } = attachMetaFunnelOutcomes(
      tree,
      [
        makeLead({ utm_content: "LP Ad", created_at: IN, call_booked_at: IN }),
        makeLead({ utm_content: "nope", created_at: IN }),
        makeLead({ utm_content: "LP Ad", created_at: OUT })
      ],
      known,
      "2026-09-01",
      "2026-09-30"
    );
    expect(unmatchedLeadCount).toBe(1);
    expect(campaigns[0]!.ad_sets[0]!.ads[0]).toMatchObject({ formFilled: 1, booked: 1 });
  });
});

describe("transformMetaInsightsRows landing_page_views", () => {
  const base = { date_start: "2026-09-10", adset_id: "s1", ad_id: "a1" } as MetaInsightsRow;
  it("extracts landing_page_view, ignoring omni_landing_page_view", () => {
    const [row] = transformMetaInsightsRows(
      [
        {
          ...base,
          actions: [
            { action_type: "landing_page_view", value: "23" },
            { action_type: "omni_landing_page_view", value: "25" }
          ]
        }
      ],
      "acct",
      "org"
    );
    expect(row!.landing_page_views).toBe(23);
  });
  it("is null when the action is absent", () => {
    const [row] = transformMetaInsightsRows(
      [{ ...base, actions: [{ action_type: "lead", value: "2" }] }],
      "acct",
      "org"
    );
    expect(row!.landing_page_views).toBeNull();
  });
});
