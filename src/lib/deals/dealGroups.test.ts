import { describe, expect, it } from "vitest";
import {
  classifyOpenDeal,
  groupOpenDeals,
  istWeekEndDateString,
  needsNextStep
} from "@/lib/deals/dealGroups";
import type { LeadRow } from "@/lib/leads/types";

function lead(
  patch: Partial<Pick<LeadRow, "id" | "next_step" | "next_action_at" | "call_showed_at">>
): LeadRow {
  return {
    id: patch.id ?? "l1",
    next_step: patch.next_step === undefined ? "Call" : patch.next_step,
    next_action_at: patch.next_action_at === undefined ? null : patch.next_action_at,
    call_showed_at: patch.call_showed_at ?? "2026-11-01T10:00:00.000Z"
  } as LeadRow;
}

describe("classifyOpenDeal IST boundaries", () => {
  it("treats a due instant before IST midnight as today and after as tomorrow", () => {
    // 10:00 IST on 20 Nov 2026 = 04:30 UTC. Same calendar day until 18:29:59 UTC.
    const now = new Date("2026-11-20T04:30:00.000Z");
    expect(
      classifyOpenDeal(
        lead({ next_action_at: "2026-11-20T18:20:00.000Z" }),
        now
      )
    ).toBe("today");
    // 00:01 IST on 21 Nov 2026 = 18:31 UTC
    expect(
      classifyOpenDeal(
        lead({ next_action_at: "2026-11-20T18:31:00.000Z" }),
        now
      )
    ).toBe("tomorrow");
  });

  it("is overdue when due is before now on the same IST day", () => {
    const now = new Date("2026-11-20T10:00:00.000Z"); // 15:30 IST
    expect(
      classifyOpenDeal(
        lead({ next_action_at: "2026-11-20T09:00:00.000Z" }),
        now
      )
    ).toBe("overdue");
  });

  it("buckets the rest of the IST week after tomorrow, then later", () => {
    // Wednesday 18 Nov 2026 10:00 IST = 04:30 UTC. Week ends Sunday 22 Nov.
    const wed = new Date("2026-11-18T04:30:00.000Z");
    expect(istWeekEndDateString(wed)).toBe("2026-11-22");
    expect(
      classifyOpenDeal(
        lead({ next_action_at: "2026-11-19T04:30:00.000Z" }),
        wed
      )
    ).toBe("tomorrow");
    expect(
      classifyOpenDeal(
        lead({ next_action_at: "2026-11-20T04:30:00.000Z" }),
        wed
      )
    ).toBe("this_week");
    expect(
      classifyOpenDeal(
        lead({ next_action_at: "2026-11-22T18:29:00.000Z" }),
        wed
      )
    ).toBe("this_week");
    expect(
      classifyOpenDeal(
        lead({ next_action_at: "2026-11-22T18:31:00.000Z" }),
        wed
      )
    ).toBe("later");
  });

  it("needs next step when either field is missing, even if the other is set", () => {
    expect(needsNextStep(lead({ next_step: null, next_action_at: "2026-11-21T00:00:00.000Z" }))).toBe(
      true
    );
    expect(needsNextStep(lead({ next_step: "Call", next_action_at: null }))).toBe(true);
    expect(needsNextStep(lead({ next_step: "  ", next_action_at: "2026-11-21T00:00:00.000Z" }))).toBe(
      true
    );
    expect(
      classifyOpenDeal(lead({ next_step: null, next_action_at: "2020-01-01T00:00:00.000Z" }))
    ).toBe("needs_next_step");
  });
});

describe("groupOpenDeals", () => {
  it("hides empty groups and sorts overdue oldest first", () => {
    const now = new Date("2026-11-20T10:00:00.000Z");
    const groups = groupOpenDeals(
      [
        lead({
          id: "newer-overdue",
          next_action_at: "2026-11-20T09:00:00.000Z",
          call_showed_at: "2026-11-19T00:00:00.000Z"
        }),
        lead({
          id: "older-overdue",
          next_action_at: "2026-11-19T09:00:00.000Z",
          call_showed_at: "2026-11-01T00:00:00.000Z"
        }),
        lead({
          id: "need",
          next_step: null,
          next_action_at: null,
          call_showed_at: "2026-11-18T00:00:00.000Z"
        })
      ],
      now
    );
    expect(groups.map((g) => g.id)).toEqual(["overdue", "needs_next_step"]);
    expect(groups[0]!.rows.map((r) => r.id)).toEqual(["older-overdue", "newer-overdue"]);
  });
});
