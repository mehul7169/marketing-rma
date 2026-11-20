import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => "/deals",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

import {
  resetDealDrawer,
  useDealDrawerParam
} from "@/components/deals/useDealDrawerParam";

beforeEach(() => {
  resetDealDrawer();
  window.history.replaceState(null, "", "/deals");
});

afterEach(() => {
  resetDealDrawer();
});

describe("useDealDrawerParam", () => {
  it("opens and closes from client state without waiting on navigation", () => {
    const { result } = renderHook(() => useDealDrawerParam());

    act(() => {
      result.current.open("abc");
    });
    expect(result.current.dealId).toBe("abc");
    expect(new URL(window.location.href).searchParams.get("deal")).toBe("abc");

    act(() => {
      result.current.close();
    });
    expect(result.current.dealId).toBeNull();
    expect(new URL(window.location.href).searchParams.get("deal")).toBeNull();
    expect(window.location.pathname).toBe("/deals");
  });

  it("Back closes without leaving the page", () => {
    const { result } = renderHook(() => useDealDrawerParam());

    act(() => {
      result.current.open("deep-1");
    });
    expect(result.current.dealId).toBe("deep-1");

    act(() => {
      window.history.replaceState(null, "", "/deals");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.dealId).toBeNull();
    expect(window.location.pathname).toBe("/deals");
    expect(new URL(window.location.href).searchParams.get("deal")).toBeNull();
  });
});
