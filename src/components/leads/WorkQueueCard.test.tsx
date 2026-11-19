import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkQueueCard from "@/components/leads/WorkQueueCard";
import { makeLead } from "@/test/fixtures";

const writeText = vi.fn<(data: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });
});

describe("WorkQueueCard copy", () => {
  it("copies phone without opening the card", async () => {
    const onOpen = vi.fn();
    render(
      <WorkQueueCard
        lead={makeLead({ phone: "+919325930425", email: "ada@example.com" })}
        activities={[]}
        onOpen={onOpen}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy phone number" }));
    expect(onOpen).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("+919325930425");
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });
  });

  it("hides copy when phone is empty and still copies email in the header and body", async () => {
    const onOpen = vi.fn();
    render(
      <WorkQueueCard
        lead={makeLead({ phone: null, email: "ada@example.com" })}
        activities={[]}
        extraFields={[
          { id: "email", label: "Email", value: "ada@example.com" },
          { id: "phone", label: "Phone", value: "—" }
        ]}
        onOpen={onOpen}
      />
    );
    expect(screen.queryByRole("button", { name: "Copy phone number" })).toBeNull();
    const emailBtns = screen.getAllByRole("button", { name: "Copy email" });
    expect(emailBtns).toHaveLength(2);
    fireEvent.click(emailBtns[1]!);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("ada@example.com");
    });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
