import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SEARCH_DEBOUNCE_MS,
  useFilterSearch
} from "@/components/leads/useFilterSearch";

describe("useFilterSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-syncs the draft when the URL value changes", () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ urlValue }: { urlValue: string }) =>
        useFilterSearch({ urlValue, onCommit }),
      { initialProps: { urlValue: "kunal" } }
    );
    expect(result.current.draft).toBe("kunal");

    rerender({ urlValue: "puneet" });
    expect(result.current.draft).toBe("puneet");

    rerender({ urlValue: "" });
    expect(result.current.draft).toBe("");
  });

  it("Enter commits immediately, once, and cancels the debounce", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useFilterSearch({ urlValue: "", onCommit })
    );

    act(() => result.current.onChange("kunal"));
    act(() => result.current.onEnter());

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0]).toBe("kunal");
    expect(onCommit.mock.calls[0][1].immediate).toBe(true);

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 50);
    });
    expect(onCommit).toHaveBeenCalledTimes(1);

    act(() => result.current.onEnter());
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("marks an older commit stale after a newer one has begun", () => {
    const seen: Array<{
      q: string;
      immediate: boolean;
      isLatest: () => boolean;
    }> = [];
    const { result } = renderHook(() =>
      useFilterSearch({
        urlValue: "",
        onCommit: (q, meta) => {
          seen.push({ q, immediate: meta.immediate, isLatest: meta.isLatest });
        }
      })
    );

    act(() => result.current.onChange("kun"));
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    act(() => result.current.onChange("kunal"));
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    expect(seen.map((s) => s.q)).toEqual(["kun", "kunal"]);
    expect(seen[0]!.isLatest()).toBe(false);
    expect(seen[1]!.isLatest()).toBe(true);
    expect(seen.every((s) => s.immediate === false)).toBe(true);
  });
});
