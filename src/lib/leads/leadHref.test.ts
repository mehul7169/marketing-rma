import { describe, expect, it } from "vitest";
import { slackLeadUrl, withLeadParam } from "@/lib/leads/leadHref";

describe("withLeadParam", () => {
  it("sets, replaces, and clears lead without dropping other params", () => {
    expect(withLeadParam("/leads", "dead=hide", "abc")).toBe(
      "/leads?dead=hide&lead=abc"
    );
    expect(withLeadParam("/leads/queue", "?view=table&lead=old", "new")).toBe(
      "/leads/queue?view=table&lead=new"
    );
    expect(withLeadParam("/leads", "?lead=abc&dead=hide", null)).toBe(
      "/leads?dead=hide"
    );
    expect(withLeadParam("/leads", "", null)).toBe("/leads");
  });
});

describe("slackLeadUrl", () => {
  it("points new Slack messages at the drawer deep link", () => {
    expect(slackLeadUrl("lead-1", "https://tracking.runmoreads.in/leads")).toBe(
      "https://tracking.runmoreads.in/leads?lead=lead-1"
    );
  });
});
