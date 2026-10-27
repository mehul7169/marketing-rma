import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import ActionPopover from "@/components/leads/ActionPopover";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <ActionPopover
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button type="button" onClick={() => setOpen((v) => !v)}>
            Log Call
          </button>
        }
        footer={
          <button type="button" onClick={() => setOpen(false)}>
            Save
          </button>
        }
      >
        <p>Outcome options</p>
      </ActionPopover>
    </div>
  );
}

describe("ActionPopover", () => {
  it("portals content to document.body so overflow parents cannot clip it", () => {
    const { container } = render(
      <div style={{ overflow: "hidden", height: 40 }}>
        <Harness />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Log Call" }));
    const popover = screen.getByText("Outcome options").closest("[data-action-popover]");
    expect(popover).toBeTruthy();
    expect(popover?.parentElement).not.toBe(container.querySelector("[style]"));
    expect(document.body.contains(popover)).toBe(true);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Log Call" }));
    expect(screen.getByText("Outcome options")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Outcome options")).not.toBeInTheDocument();
  });

  it("closes on outside click", () => {
    render(
      <div>
        <Harness />
        <button type="button">Outside</button>
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: "Log Call" }));
    expect(screen.getByText("Outcome options")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByText("Outcome options")).not.toBeInTheDocument();
  });
});
