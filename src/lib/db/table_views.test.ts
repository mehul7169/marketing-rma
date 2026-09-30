import { beforeEach, describe, expect, it, vi } from "vitest";

/** In-memory table_views keyed by user_id:page_key. */
const rows = new Map<string, Record<string, unknown>>();

vi.mock("@/lib/db/supabaseAdmin", () => {
  function query() {
    const where: Record<string, string> = {};
    let pending: Record<string, unknown> | null = null;
    let del = false;
    const key = () => `${where.user_id}:${where.page_key}`;
    const chain = {
      select: () => chain,
      eq(col: string, val: string) {
        where[col] = val;
        return chain;
      },
      upsert(payload: Record<string, unknown>) {
        pending = { id: "row-1", ...payload };
        where.user_id = payload.user_id as string;
        where.page_key = payload.page_key as string;
        return chain;
      },
      delete() {
        del = true;
        return chain;
      },
      maybeSingle: async () => ({ data: rows.get(key()) ?? null, error: null }),
      single: async () => {
        if (pending) rows.set(key(), pending);
        return { data: rows.get(key()), error: null };
      },
      then(resolve: (v: { error: null }) => void) {
        if (del) rows.delete(key());
        resolve({ error: null });
      }
    };
    return chain;
  }
  return { supabaseAdmin: { from: () => query() } };
});

import {
  deleteTableViewForUser,
  getTableViewFilters,
  getTableViewForUser,
  saveTableViewColumns,
  saveTableViewFilters
} from "@/lib/db/table_views";

const COLS = [{ id: "email", visible: true, width: 200 }];

describe("table_views filter persistence", () => {
  beforeEach(() => rows.clear());

  it("saving filters keeps columns, saving columns keeps filters", async () => {
    await saveTableViewColumns("u1", "leads", COLS);
    await saveTableViewFilters("u1", "leads", "orgA", { source: "youtube" });
    expect((await getTableViewForUser("u1", "leads"))?.config.columns).toEqual(COLS);

    await saveTableViewColumns("u1", "leads", [{ id: "email", visible: false, width: null }]);
    expect(await getTableViewFilters("u1", "leads", "orgA")).toEqual({ source: "youtube" });
  });

  it("keeps separate state per org and per user", async () => {
    await saveTableViewFilters("u1", "leads", "orgA", { source: "youtube" });
    await saveTableViewFilters("u1", "leads", "orgB", { stage: "x" });
    await saveTableViewFilters("u2", "leads", "orgA", { source: "ig" });
    expect(await getTableViewFilters("u1", "leads", "orgA")).toEqual({ source: "youtube" });
    expect(await getTableViewFilters("u1", "leads", "orgB")).toEqual({ stage: "x" });
    expect(await getTableViewFilters("u2", "leads", "orgA")).toEqual({ source: "ig" });
    expect(await getTableViewFilters("u2", "leads-queue", "orgA")).toBeNull();
  });

  it("column reset keeps filters; deletes the row when there are none", async () => {
    await saveTableViewColumns("u1", "leads", COLS);
    await saveTableViewFilters("u1", "leads", "orgA", { q: "a" });
    await deleteTableViewForUser("u1", "leads");
    const row = await getTableViewForUser("u1", "leads");
    expect(row?.config).toEqual({ columns: [], filters: { orgA: { q: "a" } } });

    await saveTableViewColumns("u2", "leads", COLS);
    await deleteTableViewForUser("u2", "leads");
    expect(await getTableViewForUser("u2", "leads")).toBeNull();
  });
});
