import { describe, expect, it } from "vitest";
import {
  buildLeadsQuery,
  clearedLeadsFilterState,
  hasLegacyLeadsParams,
  leadsFilterChips,
  leadsHref,
  parseLeadsFilterParams
} from "@/lib/leads/listFilterParams";
import { defaultFromISO } from "@/lib/utils/date";

const TODAY = "2026-09-28";

describe("parseLeadsFilterParams", () => {
  it("defaults to hide-dead + rolling 30 days", () => {
    const s = parseLeadsFilterParams({}, TODAY);
    expect(s).toMatchObject({
      fromISO: defaultFromISO(TODAY),
      toISO: TODAY,
      isDefaultRange: true,
      dead: "hide",
      stages: [],
      followUp: []
    });
    expect(s.kpi).toBeUndefined();
  });

  it("parses multi-value source, stage and follow-up", () => {
    const s = parseLeadsFilterParams(
      {
        source: "youtube,youtubemokshvideo",
        stage: ["call_booked", "showed_up"],
        follow_up: "overdue,today"
      },
      TODAY
    );
    expect(s.sources).toEqual(["youtube", "youtubemokshvideo"]);
    expect(s.stages).toEqual(["call_booked", "showed_up"]);
    expect(s.followUp).toEqual(["overdue", "today"]);
  });

  it("maps legacy action_status onto stage / follow-up", () => {
    const s = parseLeadsFilterParams(
      { action_status: "Untouched,Follow-up Due" },
      TODAY
    );
    expect(s.stages).toEqual(["new"]);
    expect(s.followUp).toEqual(["today"]);
  });

  it("redirects qualified_call_booked cohort to Calls Booked + Qualified yes", () => {
    const s = parseLeadsFilterParams({ cohort: "qualified_call_booked" }, TODAY);
    expect(s.kpi).toBe("calls_booked");
    expect(s.qualified).toBe("yes");
    expect(s.dead).toBe("show");
  });

  it("maps lifecycle=active to dead=hide and lifecycle=all to dead=show", () => {
    expect(parseLeadsFilterParams({ lifecycle: "active" }, TODAY).dead).toBe("hide");
    expect(parseLeadsFilterParams({ lifecycle: "all" }, TODAY).dead).toBe("show");
    expect(parseLeadsFilterParams({ lifecycle: "dead" }, TODAY).dead).toBe("only");
  });
});

describe("hasLegacyLeadsParams", () => {
  it("detects retired keys and old stage values", () => {
    expect(hasLegacyLeadsParams({ lifecycle: "active" })).toBe(true);
    expect(hasLegacyLeadsParams({ cohort: "call_booked" })).toBe(true);
    expect(hasLegacyLeadsParams({ stage: "created" })).toBe(true);
    expect(hasLegacyLeadsParams({ dead: "hide", stage: "call_booked" })).toBe(false);
  });
});

describe("buildLeadsQuery", () => {
  it("round-trips through the URL", () => {
    const params = {
      from: "2026-09-01",
      to: "2026-09-10",
      source: "facebook,ig",
      stage: "call_booked",
      dead: "show",
      q: "raj"
    };
    const state = parseLeadsFilterParams(params, TODAY);
    const query = buildLeadsQuery(state);
    expect(query).toEqual(params);
    expect(parseLeadsFilterParams(query, TODAY)).toEqual(state);
  });

  it("omits the rolling range but always writes dead", () => {
    const state = parseLeadsFilterParams({}, TODAY);
    expect(buildLeadsQuery(state)).toEqual({ dead: "hide" });
  });
});

describe("leadsFilterChips", () => {
  it("has no chips for the default state", () => {
    expect(leadsFilterChips(parseLeadsFilterParams({}, TODAY))).toEqual([]);
  });

  it("removing one chip leaves the other filters intact", () => {
    const state = parseLeadsFilterParams(
      { source: "facebook,ig", stage: "call_booked", dead: "hide" },
      TODAY
    );
    const chips = leadsFilterChips(state);
    expect(chips.map((c) => c.label)).toEqual([
      "Stage: Call Booked",
      "Source: facebook, ig"
    ]);
    const withoutSource = chips.find((c) => c.id === "source")!.without;
    expect(buildLeadsQuery(withoutSource)).toEqual({
      dead: "hide",
      stage: "call_booked"
    });
  });

  it("kpi chip removes the deep link back to hide-dead", () => {
    const state = parseLeadsFilterParams(
      { kpi: "calls_booked", from: "2026-09-01", to: "2026-09-10" },
      TODAY
    );
    const chips = leadsFilterChips(state);
    expect(chips.map((c) => c.id)).toContain("kpi");
    const without = chips.find((c) => c.id === "kpi")!.without;
    expect(leadsHref(without)).toBe("/leads?from=2026-09-01&to=2026-09-10&dead=hide");
  });

  it("clear all resets to the default base", () => {
    const state = parseLeadsFilterParams(
      { from: "2026-09-01", to: "2026-09-02", source: "ig", q: "a", dead: "only" },
      TODAY
    );
    expect(leadsHref(clearedLeadsFilterState(state))).toBe("/leads?dead=hide");
  });
});
