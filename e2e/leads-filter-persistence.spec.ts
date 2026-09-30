import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * /leads + Work Queue filter persistence, multi-select and chips.
 * Writes only the test users' own table_views filter state (UI prefs).
 */

const admin = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const member = { email: process.env.E2E_MEMBER_EMAIL, password: process.env.E2E_MEMBER_PASSWORD };

async function login(browser: Browser, creds: { email?: string; password?: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email!);
  await page.getByLabel("Password").fill(creds.password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  return page;
}

async function openFilter(page: Page, name: string) {
  const trigger = page.getByRole("button", { name: `${name} filter` });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  return page.getByRole("listbox", { name });
}

async function tick(page: Page, filter: string, option: string) {
  const list = await openFilter(page, filter);
  await list.getByRole("checkbox", { name: option, exact: true }).check();
}

async function sourceOptions(page: Page): Promise<string[]> {
  const list = await openFilter(page, "Source");
  const names = await list.locator("label").allTextContents();
  await page.keyboard.press("Escape");
  return names.map((n) => n.trim());
}

function param(page: Page, key: string): string | null {
  return new URL(page.url()).searchParams.get(key);
}

test.describe("Leads filter persistence", () => {
  test.skip(
    !admin.email || !admin.password || !member.email || !member.password,
    "Set E2E_ADMIN_* and E2E_MEMBER_*"
  );
  test.setTimeout(180_000);

  test("multi-select, chips, restore, explicit URL precedence, per-user state", async ({ browser }) => {
    const a = await login(browser, admin);
    const m = await login(browser, member);

    // --- Admin: two sources + a stage via checkboxes (OR within, AND across).
    await a.goto("/leads?lifecycle=all");
    await a.locator("table tbody tr").first().click();
    await a.waitForURL(/\/leads\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const leadHref = new URL(a.url()).pathname;
    await a.goto("/leads?lifecycle=all");
    const sources = await sourceOptions(a);
    expect(sources.length).toBeGreaterThanOrEqual(2);
    const [s1, s2] = sources;
    await tick(a, "Source", s1!);
    await expect.poll(() => param(a, "source")).toBe(s1);
    await tick(a, "Source", s2!);
    await expect.poll(() => param(a, "source")?.split(",").sort().join(",")).toBe([s1, s2].sort().join(","));
    await a.keyboard.press("Escape");
    await tick(a, "Stage", "Call Booked");
    await expect.poll(() => param(a, "stage")).toBe("call_booked");
    await a.keyboard.press("Escape");
    await expect(a.getByTestId("filter-chip-source")).toContainText(s1!);
    await expect(a.getByTestId("filter-chip-source")).toContainText(s2!);
    await expect(a.getByTestId("filter-chip-stage")).toContainText("Call Booked");
    const adminUrl = a.url();

    // --- Member: a different single source.
    await m.goto("/leads?lifecycle=active");
    const memberSources = await sourceOptions(m);
    const ms = memberSources[memberSources.length - 1]!;
    await tick(m, "Source", ms);
    await expect.poll(() => param(m, "source")).toBe(ms);
    await m.keyboard.press("Escape");

    // --- Sanity 1: lead detail and back via the "Leads" breadcrumb (bare /leads).
    expect(leadHref).toBeTruthy();
    // Let the background save land before leaving the page.
    await a.waitForTimeout(1_000);
    await a.goto(leadHref!);
    await a.locator('a[href="/leads"]').first().click();
    await expect.poll(() => param(a, "stage")).toBe("call_booked");
    expect(param(a, "source")?.split(",").sort()).toEqual([s1, s2].sort());
    await expect(a.getByTestId("filter-chip-source")).toBeVisible();
    await expect(a.getByRole("button", { name: "Source filter" })).toContainText("2 selected");
    await openFilter(a, "Source");
    await a.screenshot({ path: "test-results/leads-filter-chips.png" });
    await a.keyboard.press("Escape");

    // --- Sanity 3: per-user state — member's bare /leads restores member's own filters.
    await m.goto("/leads");
    await expect.poll(() => param(m, "source")).toBe(ms);
    expect(param(m, "stage")).toBeNull();
    await a.goto("/leads");
    await expect.poll(() => a.url()).toBe(adminUrl);

    // --- Sanity 2: explicit params aren't overridden by the persisted state.
    await a.goto(`/leads?lifecycle=active&source=${encodeURIComponent(s2!)}`);
    await expect(a.getByTestId("filter-chip-source")).toHaveText(new RegExp(`Source: ${s2}`));
    expect(param(a, "source")).toBe(s2);
    expect(param(a, "stage")).toBeNull();
    await expect(a.getByTestId("filter-chip-stage")).toHaveCount(0);

    // --- Sanity 4: chip × and Clear all stay in sync with the panel.
    await a.goto(adminUrl);
    await a.getByRole("button", { name: /^Remove Source:/ }).click();
    await expect.poll(() => param(a, "source")).toBeNull();
    await expect(a.getByRole("button", { name: "Source filter" })).toContainText("All");
    await expect(a.getByTestId("filter-chip-stage")).toBeVisible();
    await expect(a.getByRole("button", { name: "Stage filter" })).toContainText("Call Booked");
    const clearedSave = a.waitForResponse(
      (r) =>
        r.url().includes("/api/table-views/leads/filters") &&
        r.request().postData()?.includes('"search":"lifecycle=active"') === true
    );
    await a.getByRole("button", { name: "Clear all" }).click();
    await expect.poll(() => new URL(a.url()).search).toBe("?lifecycle=active");
    await clearedSave;
    await expect(a.getByLabel("Active filters")).toHaveCount(0);
    await expect(a.getByRole("button", { name: "Stage filter" })).toContainText("All");
    // The cleared state is what's remembered now.
    await a.waitForTimeout(1_000);
    await a.goto("/leads");
    await expect.poll(() => new URL(a.url()).search).toBe("?lifecycle=active");

    // Leave the member's state neutral too.
    await m.goto("/leads?lifecycle=active");
    await expect.poll(() => new URL(m.url()).search).toBe("?lifecycle=active");
    await m.waitForTimeout(1_000);
  });

  test("Work Queue remembers tab and view", async ({ browser }) => {
    const a = await login(browser, admin);
    await a.goto("/leads/queue?view=cards&tab=follow_ups_due");
    await a.waitForTimeout(1_500);
    await a.goto("/leads/queue");
    await expect.poll(() => param(a, "tab")).toBe("follow_ups_due");
    expect(param(a, "view")).toBe("cards");

    await a.goto("/leads/queue?view=table");
    await a.waitForTimeout(1_500);
    await a.goto("/leads/queue");
    await expect.poll(() => a.url()).toMatch(/\/leads\/queue\?view=table$/);
  });
});
