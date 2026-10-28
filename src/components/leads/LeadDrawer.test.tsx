import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLead } from "@/test/fixtures";

const loadLeadDrawer = vi.fn();
vi.mock("@/app/leads/drawer/loadDrawer", () => ({
  loadLeadDrawer: (...args: unknown[]) => loadLeadDrawer(...args)
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => "/leads/queue",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

import LeadDrawerHost, { resetLeadDrawerCache } from "@/components/leads/LeadDrawer";
import {
  resetLeadDrawer,
  useLeadDrawerParam
} from "@/components/leads/useLeadDrawerParam";

const longNote = "W".repeat(300);

function payload(id: string, name: string) {
  return {
    lead: makeLead({ id, name }),
    activities: [
      {
        id: `${id}-act`,
        lead_id: id,
        org_id: "org-1",
        type: "note",
        outcome: null,
        note: longNote,
        created_at: "2026-10-01T00:00:00.000Z",
        created_by: null,
        actor_email: null
      }
    ],
    reminders: []
  };
}

function Harness() {
  const { open } = useLeadDrawerParam();
  return (
    <>
      <button type="button" onClick={() => open("lead-a")}>
        Open A
      </button>
      <button type="button" onClick={() => open("lead-b")}>
        Open B
      </button>
      <LeadDrawerHost />
    </>
  );
}

beforeEach(() => {
  resetLeadDrawer();
  resetLeadDrawerCache();
  loadLeadDrawer.mockReset();
  window.history.replaceState(null, "", "/leads/queue?view=table");
  loadLeadDrawer.mockImplementation(async (id: string) => ({
    ok: true,
    data: payload(id, id === "lead-a" ? "Ada" : "Bea")
  }));
});

describe("LeadDrawerHost", () => {
  it("closes from state immediately, without awaiting navigation", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    expect(screen.getByTestId("lead-drawer")).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("lead")).toBe("lead-a");

    fireEvent.click(screen.getByTestId("lead-drawer-close"));
    expect(screen.queryByTestId("lead-drawer")).not.toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("lead")).toBeNull();
  });

  it("closes on backdrop click and Escape", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    fireEvent.click(screen.getByTestId("lead-drawer-backdrop"));
    expect(screen.queryByTestId("lead-drawer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("lead-drawer")).not.toBeInTheDocument();
  });

  it("wraps a long unbroken note and does not allow horizontal overflow", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    const note = await screen.findByTestId("lead-drawer-note-text");
    expect(note).toHaveTextContent(longNote);
    expect(note.className).toMatch(/break-words/);
    expect(note.className).toMatch(/overflow-wrap:anywhere/);
    expect(screen.getByTestId("lead-drawer").className).toMatch(/overflow-x-hidden/);
  });

  it("shows an activity skeleton when switching to an uncached lead", async () => {
    loadLeadDrawer.mockImplementation(
      (id: string) =>
        new Promise((resolve) => {
          window.setTimeout(
            () =>
              resolve({
                ok: true,
                data: payload(id, id === "lead-a" ? "Ada" : "Bea")
              }),
            50
          );
        })
    );
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    await screen.findByRole("heading", { name: "Ada" });
    fireEvent.click(screen.getByRole("button", { name: "Open B" }));
    expect(screen.getByTestId("lead-drawer-activity-skeleton")).toBeInTheDocument();
    await screen.findByRole("heading", { name: "Bea" });
  });
});
