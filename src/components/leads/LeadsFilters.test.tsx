import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilterPendingRoot } from "@/components/leads/FilterPending";
import { ToolbarPortalProvider } from "@/components/leads/ToolbarPortal";
import {
  parseLeadsFilterParams,
  type LeadsFilterState
} from "@/lib/leads/listFilterParams";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav
}));

import LeadsFilters from "@/components/leads/LeadsFilters";

function state(q = "", extra: Record<string, string> = {}): LeadsFilterState {
  return parseLeadsFilterParams({ dead: "hide", q, ...extra }, "2026-10-28");
}

function renderFilters(s: LeadsFilterState) {
  return render(
    <FilterPendingRoot>
      <ToolbarPortalProvider>
        <LeadsFilters sources={["youtube"]} state={s} />
      </ToolbarPortalProvider>
    </FilterPendingRoot>
  );
}

beforeEach(() => {
  nav.push.mockReset();
  nav.replace.mockReset();
});

describe("LeadsFilters search", () => {
  it("shows Filter and Views on the toolbar", () => {
    renderFilters(state(""));
    expect(screen.getByTestId("cf-filter")).toBeInTheDocument();
    expect(screen.getByTestId("cf-saved")).toBeInTheDocument();
    expect(screen.getByTestId("leads-search")).toBeInTheDocument();
  });

  it("keeps the input in sync with URL q", () => {
    const { rerender } = renderFilters(state("kunal"));
    const input = screen.getByTestId("leads-search") as HTMLInputElement;
    expect(input.value).toBe("kunal");

    rerender(
      <FilterPendingRoot>
        <ToolbarPortalProvider>
          <LeadsFilters sources={["youtube"]} state={state("puneet")} />
        </ToolbarPortalProvider>
      </FilterPendingRoot>
    );
    expect(input.value).toBe("puneet");
  });

  it("clears q on Clear when other filters are active", () => {
    renderFilters(state("kunal", { source: "youtube" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(nav.push).toHaveBeenCalledTimes(1);
    const href = String(nav.push.mock.calls[0][0]);
    expect(href).not.toMatch(/[?&]q=/);
    expect(href).toMatch(/dead=hide/);
  });

  it("re-syncs the input when a saved view restore changes q", () => {
    const { rerender } = renderFilters(state(""));
    const input = screen.getByTestId("leads-search") as HTMLInputElement;
    expect(input.value).toBe("");

    rerender(
      <FilterPendingRoot>
        <ToolbarPortalProvider>
          <LeadsFilters sources={["youtube"]} state={state("kunal")} />
        </ToolbarPortalProvider>
      </FilterPendingRoot>
    );
    expect(input.value).toBe("kunal");
  });

  it("Enter pushes the URL once immediately", () => {
    renderFilters(state(""));
    const input = screen.getByTestId("leads-search");
    fireEvent.change(input, { target: { value: "kunal" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(String(nav.push.mock.calls[0][0])).toMatch(/q=kunal/);
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
