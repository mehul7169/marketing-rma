import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CancelBookingFields,
  buildCancelPayload,
  cancelHint
} from "@/components/leads/CancelBookingPopover";
import { defaultCancelReason } from "@/lib/leads/cancelBooking";
import { makeLead } from "@/test/fixtures";

describe("cancel booking form", () => {
  it("pre-selects not_qualified for a needs-qualification lead", () => {
    const lead = makeLead({
      call_booked_at: "2026-11-01T10:00:00.000Z",
      qualified: null
    });
    expect(defaultCancelReason(lead, "a@x.com")).toBe("not_qualified");
    render(
      <CancelBookingFields
        lead={lead}
        actorEmail="a@x.com"
        reason="not_qualified"
        onReason={vi.fn()}
        note=""
        onNote={vi.fn()}
        followUpAt=""
        onFollowUpAt={vi.fn()}
        undoQualification={false}
        onUndoQualification={vi.fn()}
      />
    );
    expect(screen.getByTestId("cancel-reason-not_qualified")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByTestId("cancel-undo-qualification")).not.toBeInTheDocument();
  });

  it("shows undo-qualification only for a Work Queue qualify+book mistake", () => {
    const lead = makeLead({
      call_booked_at: "2026-11-27T10:00:00.000Z",
      qualified: true,
      qualified_at: "2026-11-27T10:00:00.000Z"
    });
    const onUndo = vi.fn();
    render(
      <CancelBookingFields
        lead={lead}
        actorEmail="a@x.com"
        reason="logged_by_mistake"
        onReason={vi.fn()}
        note=""
        onNote={vi.fn()}
        followUpAt=""
        onFollowUpAt={vi.fn()}
        undoQualification={false}
        onUndoQualification={onUndo}
      />
    );
    fireEvent.click(screen.getByTestId("cancel-undo-qualification"));
    expect(onUndo).toHaveBeenCalledWith(true);
  });

  it("buildCancelPayload requires follow-up for unreachable and a note for other", () => {
    expect(
      buildCancelPayload({
        reason: "unreachable",
        note: "",
        followUpAt: "",
        undoQualification: false
      }).ok
    ).toBe(false);
    expect(
      buildCancelPayload({
        reason: "other",
        note: "",
        followUpAt: "",
        undoQualification: false
      }).ok
    ).toBe(false);
    expect(cancelHint("logged_by_mistake")).toMatch(/never happened/);
    expect(cancelHint("not_qualified")).toMatch(/Calls Booked/);
  });
});
