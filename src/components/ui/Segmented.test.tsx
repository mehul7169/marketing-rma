import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Segmented from "@/components/ui/Segmented";

const OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" }
];

describe("Segmented", () => {
  it("exposes radiogroup semantics and moves with arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Segmented
        ariaLabel="Range"
        options={OPTIONS}
        value="today"
        onChange={onChange}
      />
    );
    expect(screen.getByRole("radiogroup", { name: "Range" })).toBeInTheDocument();
    const today = screen.getByRole("radio", { name: "Today" });
    expect(today).toHaveAttribute("aria-checked", "true");
    today.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("7d");

    rerender(
      <Segmented ariaLabel="Range" options={OPTIONS} value="7d" onChange={onChange} />
    );
    screen.getByRole("radio", { name: "7D" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("today");
  });
});
