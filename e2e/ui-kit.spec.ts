import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

const OUT = path.join("e2e", "screenshots", "ui-kit");
const email = process.env.E2E_MEMBER_EMAIL || process.env.TEST_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD || process.env.TEST_MEMBER_PASSWORD;

async function contrastViolations(
  page: import("@playwright/test").Page,
  include?: string
) {
  const builder = new AxeBuilder({ page }).withTags(["wcag2aa"]);
  if (include) builder.include(include);
  const results = await builder.analyze();
  return results.violations.filter((v) => v.id === "color-contrast");
}

test.describe("/dev/ui kit", () => {
  test("light column screenshot + no token contrast violations", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1600 });
    await page.goto("/dev/ui");
    await expect(page.getByRole("heading", { name: "UI kit" })).toBeVisible();
    await page.screenshot({
      path: path.join(OUT, "dev-ui-light.png"),
      fullPage: true
    });
    const cancelKit = page.getByTestId("cancel-booking-kit").first();
    await expect(cancelKit).toBeVisible();
    await cancelKit.screenshot({
      path: path.join(OUT, "cancel-booking-popover.png")
    });
    const contrast = await contrastViolations(page, '[data-theme="light"]');
    expect(contrast, JSON.stringify(contrast, null, 2)).toEqual([]);
  });
});

test.describe("app pages contrast", () => {
  test.skip(!email || !password, "needs E2E/TEST member creds");

  test("Home, Leads, Work Queue have no color-contrast violations", async ({
    page
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible({
      timeout: 20_000
    });

    for (const route of ["/", "/leads?dead=hide", "/leads/queue"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const contrast = await contrastViolations(page);
      expect(contrast, `${route} ${JSON.stringify(contrast, null, 2)}`).toEqual(
        []
      );
    }
  });
});
