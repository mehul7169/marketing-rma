import { describe, expect, it } from "vitest";
import {
  listFiltersForView,
  parseQueueFilter,
  parseQueueSort,
  parseQueueTab,
  queueHref,
  queueQueryParams
} from "@/lib/leads/workQueueParams";

describe("parseQueueTab", () => {
  it("defaults to All when omitted or unknown", () => {
    expect(parseQueueTab(undefined)).toBe("all");
    expect(parseQueueTab("")).toBe("all");
    expect(parseQueueTab("all")).toBe("all");
    expect(parseQueueTab("nope")).toBe("all");
  });

  it("keeps Meetings Booked and Follow-ups", () => {
    expect(parseQueueTab("meetings_booked")).toBe("meetings_booked");
    expect(parseQueueTab("follow_ups_due")).toBe("follow_ups_due");
  });
});

describe("parseQueueSort", () => {
  it("defaults to newest", () => {
    expect(parseQueueSort(undefined)).toBe("newest");
    expect(parseQueueSort("")).toBe("newest");
    expect(parseQueueSort("newest")).toBe("newest");
    expect(parseQueueSort("nope")).toBe("newest");
  });

  it("accepts oldest, follow_up, and legacy queue", () => {
    expect(parseQueueSort("oldest")).toBe("oldest");
    expect(parseQueueSort("follow_up")).toBe("follow_up");
    expect(parseQueueSort("queue")).toBe("follow_up");
  });
});

describe("parseQueueFilter", () => {
  it("maps legacy ids on All and ignores filters on other tabs", () => {
    expect(parseQueueFilter("untouched", "all")).toBe("new");
    expect(parseQueueFilter("new", "all")).toBe("new");
    expect(parseQueueFilter("new", "meetings_booked")).toBeNull();
    expect(parseQueueFilter("bogus", "all")).toBeNull();
  });
});

describe("queueHref / queueQueryParams", () => {
  it("omits All and Newest first from the URL", () => {
    expect(
      queueHref({ view: "table", tab: "all", sort: "newest" })
    ).toBe("/leads/queue?view=table");
    expect(queueQueryParams({ view: "table" })).toEqual({ view: "table" });
  });

  it("writes non-default tab, sort, filter, search, page", () => {
    expect(
      queueHref({
        view: "cards",
        tab: "follow_ups_due",
        sort: "oldest",
        search: "piyush",
        showFormUnqualified: true,
        page: 2
      })
    ).toBe(
      "/leads/queue?view=cards&tab=follow_ups_due&show_unqualified=1&search=piyush&sort=oldest&page=2"
    );
  });
});

describe("listFiltersForView", () => {
  it("All hides form-unqualified and not-dead, using the requested sort", () => {
    expect(
      listFiltersForView({
        orgId: "o1",
        tabId: "all",
        filterId: null,
        search: "",
        showFormUnqualified: false,
        sort: "newest"
      })
    ).toEqual({
      orgId: "o1",
      dead: "hide",
      sort: "newest",
      search: undefined,
      hideFormUnqualified: true
    });
  });

  it("All + status filter + search still uses the same hideFormUnqualified flag", () => {
    expect(
      listFiltersForView({
        orgId: "o1",
        tabId: "all",
        filterId: "new",
        search: "kunal",
        showFormUnqualified: true,
        sort: "oldest"
      })
    ).toMatchObject({
      pipelineStages: ["new"],
      hideFormUnqualified: false,
      search: "kunal",
      sort: "oldest"
    });
  });

  it("Meetings / Follow-ups do not add hideFormUnqualified (counts stay as before)", () => {
    const meetings = listFiltersForView({
      orgId: "o1",
      tabId: "meetings_booked",
      filterId: "new",
      search: "",
      showFormUnqualified: false,
      sort: "follow_up"
    });
    expect(meetings.meetingsBookedOnly).toBe(true);
    expect(meetings.hideFormUnqualified).toBeUndefined();
    expect(meetings.pipelineStages).toBeUndefined();

    const followUps = listFiltersForView({
      orgId: "o1",
      tabId: "follow_ups_due",
      filterId: null,
      search: "",
      showFormUnqualified: false,
      sort: "newest"
    });
    expect(followUps.followUp).toEqual(["overdue", "today"]);
    expect(followUps.hideFormUnqualified).toBeUndefined();
  });
});
