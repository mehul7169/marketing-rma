import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeLead } from "@/test/fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() })
}));

vi.mock("@/app/leads/actions", () => ({
  reviveDeadLeadAction: vi.fn(),
  addLeadNoteAction: vi.fn(),
  logLeadCallAttemptAction: vi.fn(),
  logLeadShowOutcomeAction: vi.fn(),
  rescheduleLeadCallAction: vi.fn(),
  sendLeadWhatsAppNudgeAction: vi.fn()
}));

import WorkQueueLeadActions from "@/components/leads/WorkQueueLeadActions";
import { renderLeadColumnCell } from "@/components/table-views/leadColumnCells";
import CustomFieldsPanel from "@/components/leads/CustomFieldsPanel";

describe("WorkQueueLeadActions UI", () => {
  it("shows Log Call for Untouched and not Qualify Call", () => {
    render(
      <WorkQueueLeadActions
        lead={makeLead({ action_status: null, call_booked_at: null })}
      />
    );
    expect(screen.getByRole("button", { name: "Log Call" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Qualify Call" })
    ).not.toBeInTheDocument();
  });

  it("shows Qualify Call with shared qualification outcomes", async () => {
    const user = userEvent.setup();
    render(
      <WorkQueueLeadActions
        lead={makeLead({
          action_status: "Call Booked",
          call_booked_at: "2026-01-01T00:00:00.000Z",
          call_confirmed: null
        })}
      />
    );
    expect(
      screen.getByRole("button", { name: "Qualify Call" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log Call" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Qualify Call" }));
    expect(screen.getByRole("heading", { name: "Qualify call" })).toBeInTheDocument();
    const select = screen.getByLabelText("Outcome");
    expect(select).toHaveTextContent("No Answer");
    expect(select).toHaveTextContent("Follow-up Needed");
    expect(select).toHaveTextContent("Qualified");
    expect(select).toHaveTextContent("Unqualified");
    expect(select).not.toHaveTextContent("Confirmed");
    expect(select).not.toHaveTextContent("Not confirmed");

    await user.selectOptions(select, "qualified");
    expect(screen.getByLabelText("Call scheduled for")).toBeInTheDocument();
  });
});

describe("Revive button visibility", () => {
  it("renders Revive only when is_dead", () => {
    const { rerender } = render(
      <table>
        <tbody>
          <tr>
            {renderLeadColumnCell("actions", makeLead({ is_dead: true }), {})}
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByRole("button", { name: "Revive" })).toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <tr>
            {renderLeadColumnCell("actions", makeLead({ is_dead: false }), {})}
          </tr>
        </tbody>
      </table>
    );
    expect(
      screen.queryByRole("button", { name: "Revive" })
    ).not.toBeInTheDocument();
  });
});

describe("CustomFieldsPanel", () => {
  it("humanizes an arbitrary unknown key without code changes", () => {
    render(
      <CustomFieldsPanel
        customFields={{
          "made_up_field_xyz?": "hello",
          empty_skip: "",
          null_skip: null
        }}
      />
    );
    expect(screen.getByText("Made Up Field Xyz?")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.queryByText("Empty Skip")).not.toBeInTheDocument();
  });
});
