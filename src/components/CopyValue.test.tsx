import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CopyValue from "@/components/CopyValue";
import { Toaster, resetToasts } from "@/components/ui/Toast";

const writeText = vi.fn<(data: string) => Promise<void>>();

beforeEach(() => {
  resetToasts();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });
});

describe("CopyValue", () => {
  it("writes the stored value to the clipboard and shows Copied", async () => {
    const parent = vi.fn();
    render(
      <div onClick={parent}>
        <CopyValue value=" +919325930425 " label="Copy phone number" />
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy phone number" }));
    expect(parent).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("+919325930425");
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });
  });

  it("is not rendered when the value is empty", () => {
    const { container } = render(<CopyValue value="   " label="Copy email" />);
    expect(container).toBeEmptyDOMElement();
    const { container: missing } = render(
      <CopyValue value={null} label="Copy phone number" />
    );
    expect(missing).toBeEmptyDOMElement();
  });

  it("toasts when the clipboard API fails", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(
      <>
        <Toaster />
        <CopyValue value="ada@example.com" label="Copy email" />
      </>
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy email" }));
    await waitFor(() => {
      expect(screen.getByTestId("toast-error")).toHaveTextContent(
        "Couldn't copy — select and copy manually."
      );
    });
  });
});
