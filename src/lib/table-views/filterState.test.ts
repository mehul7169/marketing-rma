import { describe, expect, it } from "vitest";
import {
  hasExplicitFilterParams,
  parsePersistedFilterState,
  pickPersistableFilters,
  restoreHref
} from "@/lib/table-views/filterState";
import { parseTableViewConfig } from "@/lib/table-views/types";
import { defaultFromISO } from "@/lib/utils/date";

const TODAY = "2026-09-28";

describe("hasExplicitFilterParams", () => {
  it("is false for a bare nav link and page-only URLs", () => {
    expect(hasExplicitFilterParams("leads", {})).toBe(false);
    expect(hasExplicitFilterParams("leads", { page: "2" })).toBe(false);
    expect(hasExplicitFilterParams("leads-queue", {})).toBe(false);
  });

  it("treats filter and deep-link params as explicit", () => {
    expect(hasExplicitFilterParams("leads", { source: "youtube" })).toBe(true);
    expect(hasExplicitFilterParams("leads", { lifecycle: "active" })).toBe(true);
    expect(hasExplicitFilterParams("leads", { cohort: "call_booked" })).toBe(true);
    expect(hasExplicitFilterParams("leads", { lead: "abc" })).toBe(true);
    expect(hasExplicitFilterParams("leads-queue", { view: "table" })).toBe(true);
    expect(hasExplicitFilterParams("leads-queue", { lead: "abc" })).toBe(true);
    expect(hasExplicitFilterParams("leads", new URLSearchParams("q=a"))).toBe(true);
  });
});

describe("pickPersistableFilters", () => {
  it("keeps only the page's filter keys", () => {
    const params = new URLSearchParams(
      "source=facebook,ig&stage=call_booked&lifecycle=active&page=3&junk=1"
    );
    expect(pickPersistableFilters("leads", params, TODAY)).toEqual({
      source: "facebook,ig",
      stage: "call_booked",
      dead: "hide"
    });
  });

  it("drops the rolling default range but keeps a custom one", () => {
    const rolling = new URLSearchParams({
      from: defaultFromISO(TODAY),
      to: TODAY,
      lifecycle: "active"
    });
    expect(pickPersistableFilters("leads", rolling, TODAY)).toEqual({ dead: "hide" });

    const custom = new URLSearchParams({ from: "2026-09-01", to: "2026-09-10" });
    expect(pickPersistableFilters("leads", custom, TODAY)).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
      dead: "hide"
    });
  });

  it("never overwrites saved state from a cohort/event deep link", () => {
    const params = new URLSearchParams("cohort=call_booked&source=youtube");
    expect(pickPersistableFilters("leads", params, TODAY)).toBeNull();
  });

  it("never persists a lead drawer deep link", () => {
    expect(
      pickPersistableFilters("leads", new URLSearchParams("lead=abc&dead=hide"), TODAY)
    ).toBeNull();
    expect(
      pickPersistableFilters(
        "leads-queue",
        new URLSearchParams("lead=abc&view=table"),
        TODAY
      )
    ).toBeNull();
  });

  it("returns null for unknown pages", () => {
    expect(pickPersistableFilters("meta-ads", new URLSearchParams("a=1"), TODAY)).toBeNull();
  });

  it("keeps Work Queue keys", () => {
    const params = new URLSearchParams("view=cards&tab=follow_ups_due&search=raj&page=2");
    expect(pickPersistableFilters("leads-queue", params, TODAY)).toEqual({
      view: "cards",
      tab: "follow_ups_due",
      search: "raj"
    });
  });
});

describe("parsePersistedFilterState / restoreHref", () => {
  it("round-trips saved params into a redirect URL", () => {
    const saved = parsePersistedFilterState("leads", {
      source: "facebook,ig",
      stage: "call_booked",
      cohort: "ignored",
      bogus: 5
    });
    expect(saved).toEqual({ source: "facebook,ig", stage: "call_booked" });
    expect(restoreHref("/leads", saved)).toBe(
      "/leads?dead=hide&stage=call_booked&source=facebook%2Cig"
    );
  });

  it("rewrites a saved lifecycle=active view to dead=hide", () => {
    expect(restoreHref("/leads", { lifecycle: "active", source: "youtube" })).toBe(
      "/leads?dead=hide&source=youtube"
    );
  });

  it("rewrites a saved Work Queue untouched filter to new", () => {
    expect(restoreHref("/leads/queue", { filter: "untouched", view: "table" })).toBe(
      "/leads/queue?filter=new&view=table"
    );
  });

  it("does not redirect when nothing is saved", () => {
    expect(restoreHref("/leads", null)).toBeNull();
    expect(restoreHref("/leads", {})).toBeNull();
    expect(parsePersistedFilterState("leads", "nope")).toBeNull();
  });
});

describe("parseTableViewConfig with filters", () => {
  it("keeps per-org filters next to columns", () => {
    expect(
      parseTableViewConfig({
        columns: [{ id: "email", visible: true }],
        filters: { orgA: { source: "youtube" }, orgB: { stage: "x", bad: 1 } }
      })
    ).toEqual({
      columns: [{ id: "email", visible: true, width: null }],
      filters: { orgA: { source: "youtube" }, orgB: { stage: "x" } }
    });
  });

  it("accepts a filters-only row as default columns", () => {
    expect(parseTableViewConfig({ filters: { orgA: { q: "a" } } })).toEqual({
      columns: [],
      filters: { orgA: { q: "a" } }
    });
    expect(parseTableViewConfig({})).toBeNull();
  });
});
