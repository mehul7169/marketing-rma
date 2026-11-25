import { describe, expect, it, vi } from "vitest";
import {
  GRAPH_VERSION,
  isRateLimitCode,
  mapPool,
  parseSpend,
  validateAdAccount
} from "@/lib/adspend/metaGraph";

describe("meta graph helpers", () => {
  it("uses v19.0 and treats 4/17/32/613/80004 as rate limits", () => {
    expect(GRAPH_VERSION).toBe("v19.0");
    expect([4, 17, 32, 613, 80004].every(isRateLimitCode)).toBe(true);
    expect(isRateLimitCode(200)).toBe(false);
  });

  it("parses spend without inventing zeros from junk", () => {
    expect(parseSpend("10179.4")).toBe(10179.4);
    expect(parseSpend("")).toBe(0);
    expect(parseSpend("nope")).toBe(0);
  });

  it("caps mapPool concurrency", async () => {
    let inflight = 0;
    let max = 0;
    const items = [1, 2, 3, 4, 5, 6];
    await mapPool(items, 2, async (n) => {
      inflight += 1;
      max = Math.max(max, inflight);
      await new Promise((r) => setTimeout(r, 20));
      inflight -= 1;
      return n;
    });
    expect(max).toBeLessThanOrEqual(2);
  });

  it("retries rate-limit code 17 then succeeds", async () => {
    const fetchImpl = vi.fn(async () => {
      if (fetchImpl.mock.calls.length === 1) {
        return {
          json: async () => ({ error: { message: "throttle", code: 17 } })
        } as Response;
      }
      return {
        json: async () => ({
          name: "Kreative",
          account_id: "993566904723774",
          currency: "INR",
          account_status: 1
        })
      } as Response;
    });
    const v = await validateAdAccount("993566904723774", {
      accessToken: "tok",
      fetchImpl
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.account.currency).toBe("INR");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry permission code 200", async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        json: async () => ({
          error: { message: "permissions", code: 200 }
        })
      } as Response;
    });
    const v = await validateAdAccount("1", { accessToken: "tok", fetchImpl });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.isPermission).toBe(true);
      expect(v.error).toContain("#200");
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
