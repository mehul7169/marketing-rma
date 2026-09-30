import { describe, expect, it } from "vitest";
import {
  buildLeadsQuery,
  clearedLeadsFilterState,
  leadsFilterChips,
  leadsHref,
  parseLeadsFilterParams,
  parseList
} from "@/lib/leads/listFilterParams";
import { defaultFromISO } from "@/lib/utils/date";

const TODAY = "2026-09-28";
const label = { stage: (s: string) => s.toUpperCase() };

describe("parseList", () => {
  it("accepts comma-separated and repeated params, de-duplicated", () => {
    expect(parseList("a, b,,a")).toEqual(["a", "b"]);
    expect(parseList(["a", "b,c"])).toEqual(["a", "b", "c"]);
    expect(parseList(undefined)).toEqual([]);
  });
});

describe("parseLeadsFilterParams", () => {
  it("defaults to active + rolling 30 days", () => {
    const s = parseLeadsFilterParams({}, TODAY);
    expect(s).toMatchObject({
      fromISO: defaultFromISO(TODAY),
      toISO: TODAY,
      isDefaultRange: true,
      lifecycle: "active",
      sources: [],
      actionStatuses: []
    });
  });

  it("parses multi-value source, stage and action status", () => {
    const s = parseLeadsFilterParams(
      {
        source: "youtube,youtubemokshvideo",
        stage: ["call_booked", "showed"],
        action_status: "Untouched,Follow-up Due"
      },
      TODAY
    );
    expect(s.sources).toEqual(["youtube", "youtubemokshvideo"]);
    expect(s.stages).toEqual(["call_booked", "showed"]);
    expect(s.actionStatuses).toEqual(["Untouched", "Follow-up Due"]);
  });

  it("defaults lifecycle to all for cohort deep links", () => {
    expect(parseLeadsFilterParams({ cohort: "call_booked" }, TODAY).lifecycle).toBe("all");
  });

  it("ignores an invalid is_dead value", () => {
    expect(parseLeadsFilterParams({ is_dead: "maybe" }, TODAY).isDead).toBe("");
  });
});

describe("buildLeadsQuery", () => {
  it("round-trips through the URL", () => {
    const params = {
      from: "2026-09-01",
      to: "2026-09-10",
      source: "facebook,ig",
      stage: "call_booked",
      action_status: "Untouched",
      is_dead: "false",
      q: "raj",
      lifecycle: "all"
    };
    const state = parseLeadsFilterParams(params, TODAY);
    const query = buildLeadsQuery(state);
    expect(query).toEqual(params);
    expect(parseLeadsFilterParams(query, TODAY)).toEqual(state);
  });

  it("omits the rolling range but always writes lifecycle", () => {
    const state = parseLeadsFilterParams({}, TODAY);
    expect(buildLeadsQuery(state)).toEqual({ lifecycle: "active" });
  });
});

describe("leadsFilterChips", () => {
  it("has no chips for the default state", () => {
    expect(leadsFilterChips(parseLeadsFilterParams({}, TODAY), label)).toEqual([]);
  });

  it("removing one chip leaves the other filters intact", () => {
    const state = parseLeadsFilterParams(
      { source: "facebook,ig", stage: "call_booked", lifecycle: "active" },
      TODAY
    );
    const chips = leadsFilterChips(state, label);
    expect(chips.map((c) => c.label)).toEqual([
      "Source: facebook, ig",
      "Stage: CALL_BOOKED"
    ]);
    const withoutSource = chips.find((c) => c.id === "source")!.without;
    expect(buildLeadsQuery(withoutSource)).toEqual({
      lifecycle: "active",
      stage: "call_booked"
    });
  });

  it("hides the implicit 'all' lifecycle on cohort links and removes cohort back to active", () => {
    const state = parseLeadsFilterParams({ cohort: "call_booked", stage: "x" }, TODAY);
    const chips = leadsFilterChips(state, { ...label, deepLink: () => "Call booked" });
    expect(chips.map((c) => c.id)).toEqual(["cohort"]);
    expect(leadsHref(chips[0]!.without)).toBe("/leads?lifecycle=active&stage=x");
  });

  it("clear all resets to the default base", () => {
    const state = parseLeadsFilterParams(
      { from: "2026-09-01", to: "2026-09-02", source: "ig", q: "a", lifecycle: "dead" },
      TODAY
    );
    expect(leadsHref(clearedLeadsFilterState(state))).toBe("/leads?lifecycle=active");
  });
});
