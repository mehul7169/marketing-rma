import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import path from "node:path";

loadEnv();

/**
 * All tab, newest-first default, server-side sort, saved-view persistence.
 * Read-only besides the test user's table_views filter prefs.
 */

const email = process.env.E2E_MEMBER_EMAIL || process.env.TEST_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD || process.env.TEST_MEMBER_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function waitQueue(page: Page) {
  await expect(page.getByTestId("queue-controls")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
}

async function goNextPage(page: Page) {
  const next = page.getByRole("link", { name: "Next" });
  await next.scrollIntoViewIfNeeded();
  await next.click();
  await page.waitForURL(/[?&]page=2(?:&|$)/, { timeout: 20_000 });
  await waitQueue(page);
}

function param(page: Page, key: string): string | null {
  return new URL(page.url()).searchParams.get(key);
}

type RowMeta = { id: string; createdAt: string; nextActionAt: string };

async function rowMeta(page: Page): Promise<RowMeta[]> {
  const rows = page.getByTestId("work-queue-row");
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });
  const n = await rows.count();
  const out: RowMeta[] = [];
  for (let i = 0; i < n; i++) {
    const r = rows.nth(i);
    out.push({
      id: (await r.getAttribute("data-lead-id")) ?? "",
      createdAt: (await r.getAttribute("data-created-at")) ?? "",
      nextActionAt: (await r.getAttribute("data-next-action-at")) ?? ""
    });
  }
  return out;
}

function isNonIncreasing(values: string[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) return false;
  }
  return true;
}

function isNonDecreasing(values: string[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[i - 1]) return false;
  }
  return true;
}

function assertFollowUpOrder(rows: RowMeta[]) {
  const firstNull = rows.findIndex((r) => !r.nextActionAt);
  if (firstNull !== -1) {
    expect(
      rows.slice(firstNull).every((r) => !r.nextActionAt),
      "null next_action_at must be last"
    ).toBe(true);
  }
  const dated = firstNull === -1 ? rows : rows.slice(0, firstNull);
  for (let i = 1; i < dated.length; i++) {
    const prev = dated[i - 1]!;
    const cur = dated[i]!;
    expect(cur.nextActionAt >= prev.nextActionAt).toBe(true);
    if (cur.nextActionAt === prev.nextActionAt) {
      expect(cur.createdAt <= prev.createdAt).toBe(true);
    }
  }
}

async function newestQueueLeadFromDb(): Promise<{ id: string; created_at: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !email) return null;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: profile } = await sb
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!profile?.id) return null;
  const { data: mem } = await sb
    .from("memberships")
    .select("org_id")
    .eq("user_id", profile.id)
    .limit(1)
    .maybeSingle();
  if (!mem?.org_id) return null;
  const { data: rows, error } = await sb
    .from("leads")
    .select("id, created_at")
    .eq("org_id", mem.org_id)
    .eq("is_dead", false)
    .or("form_qualified.is.null,form_qualified.eq.true,qualified.not.is.null")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !rows?.[0]) return null;
  return rows[0] as { id: string; created_at: string };
}

async function screenshotChrome(page: Page, file: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  const h1 = await page.locator("h1").boundingBox();
  const controls = await page.getByTestId("queue-controls").boundingBox();
  const search = await page.getByTestId("work-queue-search").boundingBox();
  const boxes = [h1, controls, search].filter(
    (b): b is NonNullable<typeof b> => Boolean(b)
  );
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - 8);
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - 8);
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + 8;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 8;
  await page.screenshot({
    path: file,
    clip: { x, y, width: right - x, height: bottom - y }
  });
}

test.describe("Work Queue All tab and sort", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");
  test.setTimeout(180_000);

  test("default All + newest first matches DB; sort is server-side across pages", async ({
    page
  }) => {
    await login(page);
    await page.goto("/leads/queue?view=table");
    await waitQueue(page);

    await expect(page.getByTestId("queue-tab-all")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByTestId("queue-sort")).toHaveValue("newest");
    expect(param(page, "tab")).toBeNull();
    expect(param(page, "sort")).toBeNull();

    const allBadge = Number(
      (await page.getByTestId("queue-count-all").textContent())?.trim()
    );
    const listTotal = Number(
      await page.getByTestId("queue-pagination").getAttribute("data-total")
    );
    expect(allBadge).toBe(listTotal);
    expect(allBadge).toBeGreaterThan(0);

    const meetingsOnAll = (
      await page.getByTestId("queue-count-meetings_booked").textContent()
    )?.trim();
    const followOnAll = (
      await page.getByTestId("queue-count-follow_ups_due").textContent()
    )?.trim();

    const page1 = await rowMeta(page);
    expect(isNonIncreasing(page1.map((r) => r.createdAt))).toBe(true);

    const dbNewest = await newestQueueLeadFromDb();
    if (dbNewest) {
      expect(page1[0]?.id).toBe(dbNewest.id);
      expect(page1[0]?.createdAt).toBe(dbNewest.created_at);
    } else {
      test.info().annotations.push({
        type: "note",
        description: "Skipped DB newest-lead check (no service role env)"
      });
    }

    if (listTotal > 50) {
      await goNextPage(page);
      expect(param(page, "page")).toBe("2");
      const page2 = await rowMeta(page);
      expect(page2[0]?.createdAt <= page1[page1.length - 1]!.createdAt).toBe(true);
      expect(
        isNonIncreasing([...page1, ...page2].map((r) => r.createdAt))
      ).toBe(true);
    }

    await page.goto("/leads/queue?view=table&sort=oldest");
    await waitQueue(page);
    await expect(page.getByTestId("queue-sort")).toHaveValue("oldest");
    const oldest1 = await rowMeta(page);
    expect(isNonDecreasing(oldest1.map((r) => r.createdAt))).toBe(true);
    if (listTotal > 50) {
      await goNextPage(page);
      const oldest2 = await rowMeta(page);
      expect(oldest2[0]?.createdAt >= oldest1[oldest1.length - 1]!.createdAt).toBe(
        true
      );
      expect(
        isNonDecreasing([...oldest1, ...oldest2].map((r) => r.createdAt))
      ).toBe(true);
    }

    await page.goto("/leads/queue?view=table&sort=follow_up");
    await waitQueue(page);
    await expect(page.getByTestId("queue-sort")).toHaveValue("follow_up");
    const due1 = await rowMeta(page);
    assertFollowUpOrder(due1);
    if (listTotal > 50) {
      await goNextPage(page);
      const due2 = await rowMeta(page);
      assertFollowUpOrder([...due1, ...due2]);
    }

    await page.goto("/leads/queue?view=table");
    await waitQueue(page);
    expect(
      (await page.getByTestId("queue-count-meetings_booked").textContent())?.trim()
    ).toBe(meetingsOnAll);
    expect(
      (await page.getByTestId("queue-count-follow_ups_due").textContent())?.trim()
    ).toBe(followOnAll);

    await page.getByTestId("queue-tab-follow_ups_due").click();
    await waitQueue(page);
    expect(
      (await page.getByTestId("queue-count-meetings_booked").textContent())?.trim()
    ).toBe(meetingsOnAll);
    expect(
      (await page.getByTestId("queue-count-follow_ups_due").textContent())?.trim()
    ).toBe(followOnAll);
  });

  test("sort survives reload; saved view restores; explicit URL wins", async ({
    page
  }) => {
    await login(page);
    await page.goto("/leads/queue?view=table&sort=oldest");
    await waitQueue(page);
    await expect(page.getByTestId("queue-sort")).toHaveValue("oldest");
    await page.reload();
    await waitQueue(page);
    expect(param(page, "sort")).toBe("oldest");
    await expect(page.getByTestId("queue-sort")).toHaveValue("oldest");

    await page.waitForTimeout(1_500);
    await page.goto("/leads/queue");
    await expect.poll(() => param(page, "sort")).toBe("oldest");
    await waitQueue(page);
    await expect(page.getByTestId("queue-sort")).toHaveValue("oldest");

    await page.goto("/leads/queue?view=table&sort=follow_up");
    await waitQueue(page);
    expect(param(page, "sort")).toBe("follow_up");
    await expect(page.getByTestId("queue-sort")).toHaveValue("follow_up");
    await expect(page.getByTestId("queue-tab-all")).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("controls row is tidy at 1440 and wraps cleanly at 1024", async ({
    page
  }) => {
    await login(page);
    await page.goto("/leads/queue?view=table");
    await waitQueue(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await waitQueue(page);
    const wide = await page.getByTestId("queue-controls").boundingBox();
    expect(wide).toBeTruthy();
    expect(wide!.height, "single tidy row at 1440").toBeLessThan(42);
    const wideOverflow = await page
      .getByTestId("queue-controls")
      .evaluate((n) => (n as HTMLElement).scrollWidth > (n as HTMLElement).clientWidth + 1);
    expect(wideOverflow).toBe(false);
    await screenshotChrome(
      page,
      path.join("e2e", "screenshots", "work-queue-tabs-1440.png")
    );

    await page.setViewportSize({ width: 1024, height: 900 });
    await waitQueue(page);
    const narrowOverflow = await page
      .getByTestId("queue-controls")
      .evaluate((n) => (n as HTMLElement).scrollWidth > (n as HTMLElement).clientWidth + 1);
    expect(narrowOverflow).toBe(false);
    await screenshotChrome(
      page,
      path.join("e2e", "screenshots", "work-queue-tabs-1024.png")
    );

    await page.getByRole("button", { name: "Cards" }).click();
    await expect(page.getByTestId("queue-controls")).toBeVisible();
    await expect(page.getByTestId("queue-sort")).toHaveValue("newest");
  });
});
