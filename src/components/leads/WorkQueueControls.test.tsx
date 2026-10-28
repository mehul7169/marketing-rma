import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { FilterPendingRoot } from "@/components/leads/FilterPending";

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

function renderControls(
  extra: Partial<ComponentProps<typeof WorkQueueControls>> = {}
) {
  return render(
    <FilterPendingRoot>
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
    </FilterPendingRoot>
  );
}

beforeEach(() => {
  nav.push.mockReset();
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

  it("disables the status filter on Meetings / Follow-ups", () => {
    const { rerender } = renderControls();
    expect(screen.getByTestId("queue-filter")).not.toBeDisabled();
    rerender(
      <FilterPendingRoot>
        <WorkQueueControls
          view="table"
          tabId="meetings_booked"
          filterId={null}
          search=""
          showFormUnqualified={false}
          sort="newest"
          counts={COUNTS}
        />
      </FilterPendingRoot>
    );
    expect(screen.getByTestId("queue-filter")).toBeDisabled();
    expect(screen.queryByTestId("queue-show-unqualified")).toBeNull();
  });

  it("keeps sort when switching tabs", () => {
    renderControls({ sort: "oldest" });
    fireEvent.click(screen.getByTestId("queue-tab-follow_ups_due"));
    expect(nav.push).toHaveBeenCalledWith(
      "/leads/queue?view=table&tab=follow_ups_due&sort=oldest"
    );
  });
});
