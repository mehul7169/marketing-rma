import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => "/leads/queue",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

import {
  resetLeadDrawer,
  useLeadDrawerParam
} from "@/components/leads/useLeadDrawerParam";

beforeEach(() => {
  resetLeadDrawer();
  window.history.replaceState(null, "", "/leads/queue?view=table");
});

afterEach(() => {
  resetLeadDrawer();
});

describe("useLeadDrawerParam", () => {
  it("opens and closes from client state without waiting on navigation", () => {
    const { result } = renderHook(() => useLeadDrawerParam());

    act(() => {
      result.current.open("abc");
    });
    expect(result.current.leadId).toBe("abc");
    expect(new URL(window.location.href).searchParams.get("lead")).toBe("abc");

    act(() => {
      result.current.close();
    });
    expect(result.current.leadId).toBeNull();
    expect(new URL(window.location.href).searchParams.get("lead")).toBeNull();
    expect(window.location.pathname).toBe("/leads/queue");
  });

  it("initialises from ?lead= and Back closes without leaving the page", () => {
    window.history.replaceState(null, "", "/leads/queue?view=table");
    const { result } = renderHook(() => useLeadDrawerParam());

    act(() => {
      result.current.open("deep-1");
    });
    expect(result.current.leadId).toBe("deep-1");

    act(() => {
      window.history.replaceState(null, "", "/leads/queue?view=table");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.leadId).toBeNull();
    expect(window.location.pathname).toBe("/leads/queue");
    expect(new URL(window.location.href).searchParams.get("lead")).toBeNull();
  });
});
