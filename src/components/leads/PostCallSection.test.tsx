import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PostCallSection from "@/components/leads/PostCallSection";
import { makeLead } from "@/test/fixtures";

vi.mock("@/app/leads/actions", () => ({
  saveLeadActions: vi.fn()
}));

describe("PostCallSection", () => {
  it("renders a read-only status line and Open in Deals for a showed lead", () => {
    render(
      <PostCallSection
        lead={makeLead({
          id: "lead-99",
          call_showed: true,
          post_call_status: "contract_shared",
          next_step: "Call about pricing",
          next_action_at: "2026-11-22T09:30:00.000Z"
        })}
      />
    );
    expect(
      screen.getByText("Deal: Open · Proposal sent · Next: Call about pricing, 22 Nov 3:00 PM")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Deals" })).toHaveAttribute(
      "href",
      "/deals?deal=lead-99"
    );
    expect(screen.queryByText("Reminder sent")).not.toBeInTheDocument();
    expect(screen.queryByText("Post-call status")).not.toBeInTheDocument();
    expect(screen.queryByText("Deal")).not.toBeInTheDocument();
    expect(screen.getByText("Recording link")).toBeInTheDocument();
  });

  it("renders nothing until the lead has shown up", () => {
    const { container } = render(<PostCallSection lead={makeLead({ call_showed: null })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
