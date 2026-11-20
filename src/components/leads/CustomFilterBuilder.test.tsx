import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CustomFilterBuilder from "@/components/leads/CustomFilterBuilder";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe("CustomFilterBuilder", () => {
  it("applies a complete condition without an Apply click", async () => {
    const onApply = vi.fn();
    render(
      <CustomFilterBuilder
        filter={null}
        customKeys={[]}
        enumValues={{}}
        onApply={onApply}
        open
        onOpenChange={vi.fn()}
      />
    );
    fireEvent.change(screen.getByTestId("cf-field"), { target: { value: "form_qualified" } });
    expect(screen.getByTestId("cf-op")).toHaveValue("is_yes");
    expect(onApply).not.toHaveBeenCalled();
    await delay(400);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        match: "all",
        conditions: [expect.objectContaining({ field: "form_qualified", op: "is_yes" })]
      })
    );
  });

  it("ignores incomplete rows", async () => {
    const onApply = vi.fn();
    render(
      <CustomFilterBuilder
        filter={null}
        customKeys={[]}
        enumValues={{}}
        onApply={onApply}
        open
        onOpenChange={vi.fn()}
      />
    );
    fireEvent.change(screen.getByTestId("cf-field"), { target: { value: "name" } });
    await delay(400);
    expect(onApply).not.toHaveBeenCalled();
  });
});
