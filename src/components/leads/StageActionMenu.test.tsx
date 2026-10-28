import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StageActionMenu from "@/components/leads/StageActionMenu";
import { LIFECYCLE_ERRORS } from "@/lib/leads/lifecycle";
import { makeLead } from "@/test/fixtures";

describe("StageActionMenu", () => {
  it("portals the menu and closes on Escape", () => {
    render(
      <div style={{ overflow: "hidden", height: 24 }}>
        <StageActionMenu
          lead={makeLead()}
          onRun={vi.fn()}
          onConfirm={vi.fn()}
        />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const item = screen.getByRole("menuitem", { name: "Log call" });
    expect(item).toBeInTheDocument();
    expect(item.closest("[data-action-popover]")).toBeTruthy();
    expect(document.body.contains(item)).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("menuitem", { name: "Log call" })
    ).not.toBeInTheDocument();
  });

  it("opens Log call from the menu with Save pinned in the footer", () => {
    render(
      <StageActionMenu lead={makeLead()} onRun={vi.fn()} onConfirm={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Log call" }));
    expect(screen.getByText("Log call")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("disables Mark showed when there is no booking", () => {
    render(
      <StageActionMenu
        lead={makeLead({
          first_contacted_at: "2026-10-01T00:00:00.000Z",
          call_booked_at: null
        })}
        onRun={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const item = screen.getByTestId("stage-action-mark_showed");
    expect(item).toBeDisabled();
    expect(item).toHaveAttribute("title", LIFECYCLE_ERRORS.showedNeedsBooking);
  });
});
