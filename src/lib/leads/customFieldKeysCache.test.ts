import { afterEach, describe, expect, it, vi } from "vitest";
import {
  customFieldKeysCacheTtlMs,
  invalidateCustomFieldKeysCache,
  peekCustomFieldKeysCache,
  putCustomFieldKeysCache,
  rememberCustomFieldKeys
} from "@/lib/leads/customFieldKeysCache";

afterEach(() => {
  invalidateCustomFieldKeysCache();
  vi.useRealTimers();
});

describe("customFieldKeysCache", () => {
  it("returns a warm hit and expires after the TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T00:00:00.000Z"));
    putCustomFieldKeysCache("org-1", ["b", "a", "a"]);
    expect(peekCustomFieldKeysCache("org-1")).toEqual(["a", "b"]);

    vi.advanceTimersByTime(customFieldKeysCacheTtlMs() - 1);
    expect(peekCustomFieldKeysCache("org-1")).toEqual(["a", "b"]);

    vi.advanceTimersByTime(2);
    expect(peekCustomFieldKeysCache("org-1")).toBeNull();
  });

  it("merges new keys into a warm cache and ignores a cold one", () => {
    putCustomFieldKeysCache("org-1", ["city"]);
    rememberCustomFieldKeys("org-1", ["city", "budget"]);
    expect(peekCustomFieldKeysCache("org-1")).toEqual(["budget", "city"]);

    invalidateCustomFieldKeysCache("org-1");
    rememberCustomFieldKeys("org-1", ["new_key"]);
    expect(peekCustomFieldKeysCache("org-1")).toBeNull();
  });
});
