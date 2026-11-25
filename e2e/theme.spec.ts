import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

const OUT = path.join("e2e", "screenshots", "theme");
const email = process.env.E2E_MEMBER_EMAIL || process.env.TEST_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD || process.env.TEST_MEMBER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD;

const PAGES: Array<{ name: string; path: string }> = [
  { name: "home", path: "/" },
  { name: "leads", path: "/leads?dead=hide" },
  { name: "work-queue", path: "/leads/queue" },
  { name: "deals", path: "/deals" },
  { name: "insights", path: "/insights" },
  { name: "meta-ads", path: "/meta-ads" },
  { name: "website", path: "/website" }
];

async function contrastViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
  return results.violations.filter((v) => v.id === "color-contrast");
}

async function login(page: Page, user = email!, pass = password!) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user);
  await page.getByLabel("Password").fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function shot(page: Page, file: string) {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
}

test.describe("theme no-flash", () => {
  test("dark cookie first paint is dark", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await page.context().addCookies([
      {
        name: "theme",
        value: "dark",
        url: test.info().project.use.baseURL ?? "http://127.0.0.1:3000"
      }
    ]);
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme).toBe("dark");
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
    );
    expect(bg.toLowerCase()).toBe("#0b0b0c");
    await page.screenshot({
      path: path.join(OUT, "no-flash-dark.png")
    });
  });
});

test.describe("theme screenshots and contrast", () => {
  test.skip(!email || !password, "needs E2E/TEST member creds");
  test.setTimeout(180_000);

  test("every page in light and dark, plus dark overlays", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const theme of ["light", "dark"] as const) {
      await page.goto("/");
      await setTheme(page, theme);
      for (const route of PAGES) {
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await shot(page, `${route.name}-${theme}.png`);
      }
    }

    await setTheme(page, "dark");

    await page.goto("/leads?dead=hide");
    await page.waitForLoadState("networkidle");
    const nameBtn = page.locator("table tbody tr td:first-child button").first();
    await expect(nameBtn).toBeVisible({ timeout: 20_000 });
    await nameBtn.click();
    const drawer = page.getByTestId("lead-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(".skeleton-shimmer")).toHaveCount(0, {
      timeout: 20_000
    });
    await shot(page, "drawer-dark.png");

    await page.goto("/leads/queue?view=table");
    await expect(page.getByTestId("queue-controls")).toBeVisible({
      timeout: 20_000
    });
    await page.getByTestId("cf-filter").click();
    await expect(page.getByTestId("cf-popover")).toBeVisible();
    await shot(page, "filter-popover-dark.png");
    await page.keyboard.press("Escape");

    const needPhone = (await page.getByTestId("copy-phone").count()) === 0;
    if (needPhone) {
      await page.getByRole("button", { name: "Columns" }).click();
      const phone = page.locator("#col-phone");
      if (await phone.count()) {
        if (!(await phone.isChecked())) await phone.check();
      }
      await page.getByRole("button", { name: "Columns" }).click();
    }
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("denied")) }
      });
    });
    const copyBtn = page.getByTestId("copy-phone").first();
    await expect(copyBtn).toBeAttached({ timeout: 10_000 });
    await copyBtn.scrollIntoViewIfNeeded();
    await copyBtn.click({ force: true });
    await expect(page.getByTestId("toast-error")).toBeVisible();
    await shot(page, "toast-dark.png");

    for (const route of ["/", "/leads?dead=hide", "/leads/queue", "/deals"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const contrast = await contrastViolations(page);
      expect(contrast, `${route} ${JSON.stringify(contrast, null, 2)}`).toEqual(
        []
      );
    }
  });
});

test.describe("admin theme screenshots", () => {
  test.skip(!adminEmail || !adminPassword, "needs admin creds");
  test.setTimeout(90_000);

  test("Client Ads and Organizations in both themes", async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
    await page.setViewportSize({ width: 1440, height: 900 });
    const adminPages = [
      { name: "clients-ads", path: "/clients-ads" },
      { name: "organizations", path: "/admin/organizations" }
    ];
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/");
      await setTheme(page, theme);
      for (const route of adminPages) {
        await page.goto(route.path);
        if (!page.url().includes(route.path)) {
          test.info().annotations.push({
            type: "skip",
            description: `${route.path} not reachable as this admin`
          });
          continue;
        }
        await page.waitForLoadState("networkidle");
        await shot(page, `${route.name}-${theme}.png`);
      }
    }
  });
});

test.describe("login both themes", () => {
  test("login page light and dark", async ({ page }) => {
    const origin = test.info().project.use.baseURL ?? "http://127.0.0.1:3000";
    await page.context().addCookies([
      { name: "theme", value: "light", url: origin }
    ]);
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await shot(page, "login-light.png");

    await page.context().addCookies([
      { name: "theme", value: "dark", url: origin }
    ]);
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await shot(page, "login-dark.png");
  });
});
