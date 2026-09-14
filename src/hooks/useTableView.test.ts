import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTableView } from "@/hooks/useTableView";
import type { TableColumnConfig } from "@/lib/table-views/types";

const defaults: TableColumnConfig[] = [
  { id: "name", visible: true },
  { id: "email", visible: true },
  { id: "phone", visible: false },
  { id: "actions", visible: true }
];

describe("useTableView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to defaults when no saved config exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("available-columns")) {
          return {
            ok: true,
            json: async () => ({
              columns: defaults.map((c) => ({
                id: c.id,
                label: c.id,
                source: "fixed" as const
              }))
            })
          };
        }
        return { ok: true, json: async () => null };
      })
    );

    const { result } = renderHook(() =>
      useTableView("leads", { defaultColumns: defaults })
    );

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.visibleColumns.map((c) => c.id)).toEqual([
      "name",
      "email",
      "actions"
    ]);
  });

  it("reorders, hides, and resets to default", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT" || init?.method === "DELETE") {
        return { ok: true, json: async () => ({ ok: true, columns: [] }) };
      }
      if (String(url).includes("available-columns")) {
        return {
          ok: true,
          json: async () => ({
            columns: defaults.map((c) => ({
              id: c.id,
              label: c.id,
              source: "fixed" as const
            }))
          })
        };
      }
      return {
        ok: true,
        json: async () => ({
          columns: [
            { id: "email", visible: true },
            { id: "name", visible: true },
            { id: "phone", visible: true },
            { id: "actions", visible: true }
          ]
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useTableView("leads", { defaultColumns: defaults })
    );
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.columns.map((c) => c.id)).toEqual([
      "email",
      "name",
      "phone",
      "actions"
    ]);

    act(() => {
      result.current.moveColumn("email", "down");
    });
    expect(result.current.columns.map((c) => c.id)[0]).toBe("name");

    act(() => {
      result.current.setColumnVisible("phone", false);
    });
    expect(
      result.current.visibleColumns.find((c) => c.id === "phone")
    ).toBeUndefined();

    act(() => {
      result.current.resetToDefault();
    });
    await waitFor(() =>
      expect(result.current.columns.map((c) => c.id)).toEqual([
        "name",
        "email",
        "phone",
        "actions"
      ])
    );
    expect(result.current.columns.find((c) => c.id === "phone")?.visible).toBe(
      false
    );
  });

  it("hydrates from bootstrap without fetching saved config", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useTableView("leads", {
        defaultColumns: defaults,
        bootstrap: {
          pageKey: "leads",
          columns: [
            { id: "email", visible: true },
            { id: "name", visible: false }
          ],
          availableColumns: [
            { id: "email", label: "Email", source: "fixed" },
            { id: "name", label: "Name", source: "fixed" }
          ],
          savedConfig: null
        }
      })
    );

    expect(result.current.ready).toBe(true);
    expect(result.current.visibleColumns.map((c) => c.id)).toEqual(["email"]);
    // No GET for config on bootstrap path
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
