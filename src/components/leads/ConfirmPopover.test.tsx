import { fireEvent, render, screen, within } from "@testing-library/react";
import { useLayoutEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ConfirmPopover from "@/components/leads/ConfirmPopover";

function Harness({
  onCancel,
  onConfirm
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setAnchor(ref.current), []);
  return (
    <div>
      <button type="button" ref={ref}>
        Dead cell
      </button>
      {anchor ? (
        <ConfirmPopover
          title="Mark dead"
          message="Mark this lead dead?"
          confirmLabel="Mark dead"
          anchor={anchor}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      ) : null}
    </div>
  );
}

describe("ConfirmPopover", () => {
  it("anchors to the trigger, portals, and pins Confirm in the footer", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<Harness onCancel={onCancel} onConfirm={onConfirm} />);

    const dialog = screen
      .getByText("Mark this lead dead?")
      .closest("[data-action-popover]");
    expect(dialog).toBeTruthy();
    expect(document.body.contains(dialog)).toBe(true);
    expect(
      within(dialog as HTMLElement).getByRole("button", { name: "Mark dead" })
    ).toBeInTheDocument();
    expect(
      within(dialog as HTMLElement).getByRole("button", { name: "Cancel" })
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
