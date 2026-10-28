import { describe, expect, it } from "vitest";
import { leadListSortClauses } from "@/lib/leads/leadListSort";

describe("leadListSortClauses", () => {
  it("newest is created_at desc (id tiebreaker)", () => {
    expect(leadListSortClauses("newest", "call_booked_at")).toEqual([
      { column: "created_at", ascending: false },
      { column: "id", ascending: false }
    ]);
  });

  it("oldest is created_at asc", () => {
    expect(leadListSortClauses("oldest", "created_at")).toEqual([
      { column: "created_at", ascending: true },
      { column: "id", ascending: true }
    ]);
  });

  it("follow_up is next_action_at asc nulls last, then created_at desc", () => {
    expect(leadListSortClauses("follow_up", "created_at")).toEqual([
      { column: "next_action_at", ascending: true, nullsFirst: false },
      { column: "created_at", ascending: false },
      { column: "id", ascending: false }
    ]);
  });

  it("legacy queue matches follow_up", () => {
    expect(leadListSortClauses("queue", "created_at")).toEqual(
      leadListSortClauses("follow_up", "created_at")
    );
  });

  it("date / omitted still uses the KPI date field", () => {
    expect(leadListSortClauses("date", "call_booked_at")).toEqual([
      { column: "call_booked_at", ascending: false }
    ]);
    expect(leadListSortClauses(undefined, "created_at")).toEqual([
      { column: "created_at", ascending: false }
    ]);
  });
});
