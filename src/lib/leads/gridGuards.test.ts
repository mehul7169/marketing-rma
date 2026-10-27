import { describe, expect, it } from "vitest";
import { LIFECYCLE_ERRORS } from "@/lib/leads/lifecycle";
import { bookedLeadDeadWarning, lifecycleBlockReason } from "@/lib/leads/gridGuards";
import { makeLead } from "@/test/fixtures";

describe("lifecycleBlockReason", () => {
  it("blocks booking before first contact and show before booking", () => {
    const fresh = makeLead({ first_contacted_at: null, call_booked_at: null });
    expect(lifecycleBlockReason(fresh, "book_call")).toBe(
      LIFECYCLE_ERRORS.bookBeforeContact
    );
    expect(lifecycleBlockReason(fresh, "mark_showed")).toBe(
      LIFECYCLE_ERRORS.showedNeedsBooking
    );
  });

  it("allows booking after a call attempt and revive only when dead", () => {
    const contacted = makeLead({
      first_contacted_at: "2026-10-01T00:00:00.000Z",
      call_booked_at: null
    });
    expect(lifecycleBlockReason(contacted, "book_call")).toBeNull();
    expect(lifecycleBlockReason(contacted, "revive")).toBe(LIFECYCLE_ERRORS.notDead);
    expect(
      lifecycleBlockReason(makeLead({ is_dead: true }), "revive")
    ).toBeNull();
  });
});

describe("bookedLeadDeadWarning", () => {
  it("warns when marking a booked or showed lead dead", () => {
    expect(bookedLeadDeadWarning(makeLead({ call_booked_at: null }))).toBeNull();
    expect(
      bookedLeadDeadWarning(makeLead({ call_booked_at: "2026-10-01T00:00:00.000Z" }))
    ).toMatch(/booked call/);
    expect(
      bookedLeadDeadWarning(
        makeLead({
          call_booked_at: "2026-10-01T00:00:00.000Z",
          call_showed: true
        })
      )
    ).toMatch(/showed up/);
  });
});
