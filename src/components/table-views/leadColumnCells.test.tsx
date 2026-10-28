import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderLeadColumnCell } from "@/components/table-views/leadColumnCells";
import { LIFECYCLE_ERRORS } from "@/lib/leads/lifecycle";
import { makeLead } from "@/test/fixtures";

describe("Showed Up cell", () => {
  it("disables Yes with a tooltip when there is no booking", () => {
    render(
      <table>
        <tbody>
          <tr>
            {renderLeadColumnCell(
              "call_showed",
              makeLead({
                first_contacted_at: "2026-10-01T00:00:00.000Z",
                call_booked_at: null,
                call_showed: null
              }),
              {
                edit: {
                  onLifecycle: vi.fn(),
                  onConfirm: vi.fn()
                }
              }
            )}
          </tr>
        </tbody>
      </table>
    );

    const yes = screen.getByTestId("call-showed-yesno").querySelector(
      '[data-value="yes"]'
    ) as HTMLButtonElement;
    expect(yes).toBeDisabled();
    expect(yes).toHaveAttribute("title", LIFECYCLE_ERRORS.showedNeedsBooking);
  });
});
