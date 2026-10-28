import { test, expect, type Page, type Request } from "@playwright/test";

/**
 * Drawer open/close is client state + history.pushState/replaceState.
 * Must not refetch the Work Queue list. Read-only (no note writes).
 */

const email = process.env.E2E_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

function isListRsc(req: Request): boolean {
  const url = req.url();
  if (!url.includes("/leads")) return false;
  if (url.includes("/api/")) return false;
  const h = req.headers();
  if (h.rsc === "1") return true;
  try {
    if (new URL(url).searchParams.has("_rsc")) return true;
  } catch {
    return false;
  }
  return false;
}

async function openFirstLead(page: Page) {
  const name = page.locator("table tbody tr td:first-child button");
  await expect(name.first()).toBeVisible({ timeout: 20_000 });
  await name.first().click();
  await expect(page.getByTestId("lead-drawer")).toBeVisible();
}

test.describe("lead drawer close", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");
  test.setTimeout(90_000);

  test("open/close is instant and does not refetch the list", async ({
    page
  }) => {
    await login(page);
    await page.goto("/leads/queue?view=table");
    await expect(
      page.locator("table tbody tr td:first-child button").first()
    ).toBeVisible({ timeout: 20_000 });

    const rsc: string[] = [];
    page.on("request", (req) => {
      if (isListRsc(req)) rsc.push(req.url());
    });

    await openFirstLead(page);
    const lead = new URL(page.url()).searchParams.get("lead");
    expect(lead).toBeTruthy();
    expect(rsc, "opening must not refetch RSC list").toEqual([]);

    const drawer = page.getByTestId("lead-drawer");
    const t0 = Date.now();
    await page.getByTestId("lead-drawer-backdrop").click();
    await expect(drawer).toBeHidden({ timeout: 100 });
    const backdropMs = Date.now() - t0;
    expect(backdropMs, `backdrop close ${backdropMs}ms`).toBeLessThan(100);
    expect(new URL(page.url()).searchParams.get("lead")).toBeNull();
    expect(rsc).toEqual([]);

    await openFirstLead(page);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden({ timeout: 100 });
    expect(rsc).toEqual([]);

    await openFirstLead(page);
    const t1 = Date.now();
    await page.getByTestId("lead-drawer-close").click();
    await expect(drawer).toBeHidden({ timeout: 100 });
    const closeMs = Date.now() - t1;
    expect(closeMs, `Close button ${closeMs}ms`).toBeLessThan(100);
    expect(rsc).toEqual([]);
    // eslint-disable-next-line no-console
    console.log(`drawer close ms backdrop=${backdropMs} button=${closeMs}`);
  });

  test("popover/date click inside drawer does not close it; switch leads; Back; deep link; wrap", async ({
    page
  }) => {
    await login(page);
    await page.goto("/leads/queue?view=table");
    const names = page.locator("table tbody tr td:first-child button");
    await expect(names.first()).toBeVisible({ timeout: 20_000 });
    const count = await names.count();
    expect(count).toBeGreaterThan(1);

    const rsc: string[] = [];
    page.on("request", (req) => {
      if (isListRsc(req)) rsc.push(req.url());
    });

    await names.nth(0).click();
    const drawer = page.getByTestId("lead-drawer");
    await expect(drawer).toBeVisible();
    const due = drawer.locator('input[type="datetime-local"]').first();
    await expect(due).toBeVisible();
    await due.click();
    await expect(drawer).toBeVisible();

    await names.nth(1).evaluate((el) => (el as HTMLButtonElement).click());
    await expect(page.getByTestId("lead-drawer")).toBeVisible();
    await expect(page.getByTestId("lead-drawer-activity-skeleton"))
      .toBeVisible({ timeout: 2_000 })
      .catch(() => null);
    expect(rsc, "switching leads must not refetch RSC list").toEqual([]);

    await page.getByTestId("lead-drawer-close").click();
    await expect(page.getByTestId("lead-drawer")).toBeHidden();

    await names.nth(0).click();
    await expect(page.getByTestId("lead-drawer")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("lead-drawer")).toBeHidden({ timeout: 500 });
    expect(page.url()).toMatch(/\/leads\/queue/);
    expect(new URL(page.url()).searchParams.get("lead")).toBeNull();

    await names.nth(0).click();
    const id = new URL(page.url()).searchParams.get("lead");
    expect(id).toBeTruthy();
    await page.getByTestId("lead-drawer-close").click();
    await expect(page.getByTestId("lead-drawer")).toBeHidden();

    await page.goto(`/leads/queue?view=table&lead=${id}`);
    await expect(page.getByTestId("lead-drawer")).toBeVisible({
      timeout: 20_000
    });

    await page.getByTestId("lead-drawer").evaluate((el) => {
      const p = document.createElement("p");
      p.setAttribute("data-testid", "lead-drawer-injected-note");
      p.className = "break-words [overflow-wrap:anywhere] text-sm";
      p.textContent = "W".repeat(300);
      el.querySelector('[data-testid="lead-drawer-activity"]')?.appendChild(p) ??
        el.appendChild(p);
    });
    const overflow = await page.getByTestId("lead-drawer").evaluate((el) => {
      const p =
        el.querySelector('[data-testid="lead-drawer-note-text"]') ||
        el.querySelector('[data-testid="lead-drawer-injected-note"]');
      const noteOverflow = p
        ? (p as HTMLElement).scrollWidth > (p as HTMLElement).clientWidth + 2
        : false;
      return {
        drawer: el.scrollWidth > el.clientWidth + 2,
        noteOverflow
      };
    });
    expect(overflow.drawer).toBe(false);
  });
});
