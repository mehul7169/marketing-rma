import { act, render, screen, waitFor } from "@testing-library/react";
import { useMemo } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIFECYCLE_ERRORS } from "@/lib/leads/lifecycle";
import { makeLead } from "@/test/fixtures";

const leadLifecycleAction = vi.fn();
vi.mock("@/app/leads/actions", () => ({
  leadLifecycleAction: (...args: unknown[]) => leadLifecycleAction(...args),
  saveLeadPlainFieldsAction: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/leads",
  useSearchParams: () => new URLSearchParams()
}));

import { useLeadGrid } from "@/components/leads/useLeadGrid";
import { Toaster, resetToasts } from "@/components/ui/Toast";
import type { LeadRow } from "@/lib/leads/types";

function Harness({ lead }: { lead: LeadRow }) {
  const initial = useMemo(() => [lead], [lead]);
  const grid = useLeadGrid(initial);
  const row = grid.rows[0]!;
  return (
    <>
      <Toaster />
      <div data-testid="showed">{String(row.call_showed)}</div>
      <button
        type="button"
        onClick={() => grid.runLifecycle(lead, "mark_showed")}
      >
        force showed
      </button>
    </>
  );
}

beforeEach(() => {
  resetToasts();
  leadLifecycleAction.mockReset();
});

describe("useLeadGrid rejected lifecycle", () => {
  it("toasts the lead name + server message and rolls the cell back", async () => {
    const lead = makeLead({
      name: "Kunal Jiwani",
      first_contacted_at: "2026-10-01T00:00:00.000Z",
      call_booked_at: "2026-10-02T00:00:00.000Z",
      call_showed: null
    });
    leadLifecycleAction.mockResolvedValue({
      ok: false,
      error: LIFECYCLE_ERRORS.showedNeedsBooking
    });

    render(<Harness lead={lead} />);
    expect(screen.getByTestId("showed")).toHaveTextContent("null");

    await act(async () => {
      screen.getByRole("button", { name: "force showed" }).click();
    });

    await waitFor(() => {
      expect(leadLifecycleAction).toHaveBeenCalled();
      expect(screen.getByTestId("toast-error")).toHaveTextContent(
        "Kunal Jiwani: Book a call before marking it as showed."
      );
    });
    expect(screen.getByTestId("toast-stack")).toBeInTheDocument();
    expect(screen.getByTestId("showed")).toHaveTextContent("null");
  });
});
