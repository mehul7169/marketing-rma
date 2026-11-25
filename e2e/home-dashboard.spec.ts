import { test, expect, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

const OUT = path.join("e2e", "screenshots", "home");
const email = process.env.E2E_MEMBER_EMAIL || process.env.TEST_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD || process.env.TEST_MEMBER_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("home-page")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
}

test.describe("Home dashboard", () => {
  test.skip(!email || !password, "needs E2E/TEST member creds");
  test.setTimeout(120_000);

  test("range and traffic persist in the URL and refresh cards", async ({
    page
  }) => {
    await login(page);
    await openHome(page);
    await expect(page).not.toHaveURL(/range=/);

    await page.getByTestId("home-range").getByRole("radio", { name: "7D" }).click();
    await expect(page).toHaveURL(/range=7d/);
    await expect(page.getByTestId("home-funnel")).toBeVisible();

    await page.getByTestId("home-traffic").getByRole("radio", { name: "Paid" }).click();
    await expect(page).toHaveURL(/range=7d/);
    await expect(page).toHaveURL(/traffic=paid/);
    await expect(page.getByTestId("home-kpi-leads")).toBeVisible();

    await page.getByTestId("home-range").getByRole("radio", { name: "30D" }).click();
    await expect(page).toHaveURL(/traffic=paid/);
    await expect(page).not.toHaveURL(/range=/);
  });

  test("Booked funnel row opens /leads with a matching count", async ({
    page
  }, info) => {
    test.skip(
      info.project.name !== "chromium",
      "count match is chromium-only (CountUp is 0 on first paint)"
    );
    await login(page);
    await openHome(page);
    const row = page.getByTestId("funnel-row-calls_booked");
    await expect(row).toBeVisible();
    const raw = await row.locator(".tabular-nums").last().textContent();
    const booked = (raw ?? "").replace(/,/g, "").trim();
    expect(booked).toMatch(/^\d+$/);
    expect(booked).not.toBe("0");

    await row.click();
    await expect(page).toHaveURL(/\/leads\?/);
    await expect(page).toHaveURL(/kpi=calls_booked/);
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByText(new RegExp(`^${booked} in `))).toBeVisible();
  });

  test("light and dark screenshots at 1440 / 1024 / 768", async ({
    page
  }, info) => {
    test.skip(
      info.project.name !== "chromium",
      "full screenshot matrix is chromium-only"
    );
    mkdirSync(OUT, { recursive: true });
    await login(page);
    await openHome(page);
    await page.waitForTimeout(900);

    for (const theme of ["light", "dark"] as const) {
      await page.getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const width of [1440, 1024, 768] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.screenshot({
          path: path.join(OUT, `home-${theme}-${width}.png`),
          fullPage: true
        });
      }
    }
  });

  test("reduced-motion home is visible", async ({ page }, info) => {
    test.skip(
      info.project.name !== "chromium-reduced-motion",
      "reduced-motion project only"
    );
    mkdirSync(OUT, { recursive: true });
    await login(page);
    await openHome(page);
    await expect(page.getByTestId("home-funnel")).toBeVisible();
    await expect(page.getByTestId("home-kpi-leads")).not.toHaveText("");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: path.join(OUT, "home-reduced-motion-1440.png"),
      fullPage: true
    });
  });
});
