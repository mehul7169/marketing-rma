import { describe, expect, it } from "vitest";
import {
  canCancelBooking,
  defaultCancelReason,
  isWorkQueueQualifyAndBook
} from "@/lib/leads/cancelBooking";
import { makeLead } from "@/test/fixtures";

const NOW = Date.parse("2026-10-27T10:00:00.000Z");

describe("canCancelBooking", () => {
  it("allows a booked lead that has not showed", () => {
    expect(canCancelBooking(makeLead({ call_booked_at: "2026-10-21T10:00:00.000Z" }))).toBe(
      true
    );
    expect(
      canCancelBooking(
        makeLead({ call_booked_at: "2026-10-21T10:00:00.000Z", call_showed: false })
      )
    ).toBe(true);
    expect(
      canCancelBooking(
        makeLead({ call_booked_at: "2026-10-21T10:00:00.000Z", call_showed: true })
      )
    ).toBe(false);
    expect(canCancelBooking(makeLead({ call_booked_at: null }))).toBe(false);
  });
});

describe("defaultCancelReason", () => {
  it("defaults to logged_by_mistake when this setter booked in the last 30 minutes", () => {
    expect(
      defaultCancelReason(
        makeLead({
          call_booked_at: "2026-10-27T09:45:00.000Z",
          qualified: true,
          qualified_at: "2026-10-27T09:45:00.000Z",
          qualified_by: "setter@x.com"
        }),
        "setter@x.com",
        NOW
      )
    ).toBe("logged_by_mistake");
  });

  it("defaults to not_qualified when the lead needs qualification", () => {
    expect(
      defaultCancelReason(
        makeLead({ call_booked_at: "2026-10-21T10:00:00.000Z", qualified: null }),
        "setter@x.com",
        NOW
      )
    ).toBe("not_qualified");
  });

  it("has no default when already qualified and the booking is older", () => {
    expect(
      defaultCancelReason(
        makeLead({
          call_booked_at: "2026-10-21T10:00:00.000Z",
          qualified: true,
          qualified_at: "2026-10-21T10:00:00.000Z",
          qualified_by: "other@x.com"
        }),
        "setter@x.com",
        NOW
      )
    ).toBeNull();
  });
});

describe("isWorkQueueQualifyAndBook", () => {
  it("is true when qualify and book landed in the same 5 minutes", () => {
    expect(
      isWorkQueueQualifyAndBook(
        makeLead({
          qualified: true,
          qualified_at: "2026-10-27T10:00:00.000Z",
          call_booked_at: "2026-10-27T10:00:02.000Z"
        })
      )
    ).toBe(true);
    expect(
      isWorkQueueQualifyAndBook(
        makeLead({
          qualified: true,
          qualified_at: "2026-10-20T10:00:00.000Z",
          call_booked_at: "2026-10-27T10:00:00.000Z"
        })
      )
    ).toBe(false);
  });
});
