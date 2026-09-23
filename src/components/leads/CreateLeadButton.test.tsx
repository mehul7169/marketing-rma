import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLead } from "@/test/fixtures";

const createManualLeadAction = vi.fn();
vi.mock("@/app/leads/actions", () => ({
  createManualLeadAction: (...args: unknown[]) => createManualLeadAction(...args)
}));

import CreateLeadButton from "@/components/leads/CreateLeadButton";

beforeEach(() => vi.clearAllMocks());

describe("CreateLeadButton", () => {
  it("is disabled during org preview", () => {
    render(<CreateLeadButton disabled onCreated={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Create Lead" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", expect.stringContaining("Read-only preview"));
  });

  it("shows inline errors for missing name and phone without submitting", async () => {
    const user = userEvent.setup();
    render(<CreateLeadButton disabled={false} onCreated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create Lead" }));
    await user.click(screen.getByRole("button", { name: "Create lead" }));
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Phone is required.")).toBeInTheDocument();
    expect(createManualLeadAction).not.toHaveBeenCalled();
  });

  it("submits, calls onCreated, and closes", async () => {
    const user = userEvent.setup();
    const lead = makeLead({ id: "new-1", name: "Priya" });
    createManualLeadAction.mockResolvedValue({ ok: true, lead });
    const onCreated = vi.fn();
    render(<CreateLeadButton disabled={false} onCreated={onCreated} />);
    await user.click(screen.getByRole("button", { name: "Create Lead" }));
    await user.type(screen.getByLabelText(/Name/), "Priya");
    await user.type(screen.getByLabelText(/Phone/), "+919876543210");
    await user.selectOptions(screen.getByLabelText(/Source/), "manual");
    await user.click(screen.getByRole("button", { name: "Create lead" }));
    expect(createManualLeadAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Priya", phone: "+919876543210", source: "manual" })
    );
    expect(onCreated).toHaveBeenCalledWith(lead);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the server duplicate error with a link to the existing lead", async () => {
    const user = userEvent.setup();
    createManualLeadAction.mockResolvedValue({
      ok: false,
      error: "A lead with this phone number already exists (Vaidik U).",
      fieldErrors: { phone: "Already used by another lead in this org." },
      existingLeadId: "old-1"
    });
    render(<CreateLeadButton disabled={false} onCreated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create Lead" }));
    await user.type(screen.getByLabelText(/Name/), "Dup");
    await user.type(screen.getByLabelText(/Phone/), "+919876543210");
    await user.click(screen.getByRole("button", { name: "Create lead" }));
    expect(screen.getByRole("alert")).toHaveTextContent("already exists (Vaidik U)");
    expect(screen.getByRole("link", { name: "Open existing lead" })).toHaveAttribute(
      "href",
      "/leads/old-1"
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
