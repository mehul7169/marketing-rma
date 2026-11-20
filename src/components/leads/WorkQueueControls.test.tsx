import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { FilterPendingRoot } from "@/components/leads/FilterPending";
import { ToolbarPortalProvider } from "@/components/leads/ToolbarPortal";
import type { CustomFilter } from "@/lib/leads/customFilter";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav
}));

import WorkQueueControls from "@/components/leads/WorkQueueControls";

const COUNTS = { all: 247, meetings_booked: 12, follow_ups_due: 40 };

const TWO: CustomFilter = {
  match: "all",
  conditions: [
    { id: "c1", field: "first_contacted_at", op: "is_empty" },
    { id: "c2", field: "created_at", op: "after", value: "2026-11-01" }
  ]
};

function renderControls(
  extra: Partial<ComponentProps<typeof WorkQueueControls>> = {}
) {
  return render(
    <FilterPendingRoot>
      <ToolbarPortalProvider>
        <WorkQueueControls
          view="table"
          tabId="all"
          filterId={null}
          search=""
          showFormUnqualified={false}
          sort="newest"
          counts={COUNTS}
          {...extra}
        />
      </ToolbarPortalProvider>
    </FilterPendingRoot>
  );
}

beforeEach(() => {
  nav.push.mockReset();
  nav.replace.mockReset();
});

describe("WorkQueueControls", () => {
  it("renders All first with a count that matches the list total", () => {
    renderControls();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("data-testid"))).toEqual([
      "queue-tab-all",
      "queue-tab-meetings_booked",
      "queue-tab-follow_ups_due"
    ]);
    expect(screen.getByTestId("queue-tab-all")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("queue-count-all")).toHaveTextContent("247");
    expect(screen.getByTestId("queue-count-meetings_booked")).toHaveTextContent("12");
    expect(screen.getByTestId("queue-count-follow_ups_due")).toHaveTextContent("40");
  });

  it("defaults sort to Newest first and navigates on change", () => {
    renderControls();
    const select = screen.getByTestId("queue-sort");
    expect(select).toHaveValue("newest");
    fireEvent.change(select, { target: { value: "oldest" } });
    expect(nav.push).toHaveBeenCalledWith("/leads/queue?view=table&sort=oldest");
    fireEvent.change(select, { target: { value: "follow_up" } });
    expect(nav.push).toHaveBeenCalledWith("/leads/queue?view=table&sort=follow_up");
  });

  it("hides form-unqualified on Meetings / Follow-ups", () => {
    const { rerender } = renderControls();
    fireEvent.click(screen.getByTestId("cf-filter"));
    expect(screen.getByTestId("queue-show-unqualified")).toBeInTheDocument();
    rerender(
      <FilterPendingRoot>
        <ToolbarPortalProvider>
          <WorkQueueControls
            view="table"
            tabId="meetings_booked"
            filterId={null}
            search=""
            showFormUnqualified={false}
            sort="newest"
            counts={COUNTS}
          />
        </ToolbarPortalProvider>
      </FilterPendingRoot>
    );
    fireEvent.click(screen.getByTestId("cf-filter"));
    expect(screen.queryByTestId("queue-show-unqualified")).toBeNull();
  });

  it("keeps sort when switching tabs", () => {
    renderControls({ sort: "oldest" });
    fireEvent.click(screen.getByTestId("queue-tab-follow_ups_due"));
    expect(nav.push).toHaveBeenCalledWith(
      "/leads/queue?view=table&tab=follow_ups_due&sort=oldest"
    );
  });

  it("renders Filter, Sort, and Views on the toolbar", () => {
    renderControls();
    expect(screen.getByTestId("cf-filter")).toBeInTheDocument();
    expect(screen.getByTestId("cf-saved")).toBeInTheDocument();
    expect(screen.getByTestId("queue-sort")).toBeInTheDocument();
    expect(screen.getByTestId("work-queue-search")).toBeInTheDocument();
  });

  it("shows the all/any prefix only with 2+ conditions and toggling it navigates", () => {
    const { rerender } = renderControls({ customFilter: TWO });
    expect(screen.getByTestId("cf-match-prefix")).toHaveTextContent("Where all of:");
    fireEvent.click(screen.getByTestId("cf-match-prefix"));
    expect(String(nav.push.mock.calls[0][0])).toMatch(/[?&]cf=/);

    const one: CustomFilter = { match: "all", conditions: [TWO.conditions[0]!] };
    rerender(
      <FilterPendingRoot>
        <ToolbarPortalProvider>
          <WorkQueueControls
            view="table"
            tabId="all"
            filterId={null}
            search=""
            showFormUnqualified={false}
            sort="newest"
            counts={COUNTS}
            customFilter={one}
          />
        </ToolbarPortalProvider>
      </FilterPendingRoot>
    );
    expect(screen.queryByTestId("cf-match-prefix")).toBeNull();
  });

  it("opens the popover on a chip and removes a condition with ×", () => {
    renderControls({ customFilter: TWO });
    const chip = screen.getByTestId("filter-chip-cf:c1");
    fireEvent.click(chip.querySelector("button")!);
    expect(screen.getByTestId("cf-popover")).toBeInTheDocument();
    fireEvent.click(chip.querySelector('[aria-label^="Remove"]')!);
    expect(String(nav.push.mock.calls[0][0])).toMatch(/[?&]cf=/);
  });

  it("shows and hides the form-unqualified chip", () => {
    renderControls({ showFormUnqualified: true });
    expect(screen.getByTestId("filter-chip-unqualified")).toHaveTextContent(
      "Include form-unqualified"
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Include form-unqualified" }));
    expect(nav.push).toHaveBeenCalledWith("/leads/queue?view=table");
  });
});
