import { test, expect } from "@playwright/test";

/** /meta-ads "Funnel by ad" table — read-only, no writes. */

const email = process.env.E2E_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD;

test.describe("Meta Ads funnel-by-ad table", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");

  test("renders above Trends with expandable hierarchy and dash for n/a", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goto("/meta-ads?from=2026-08-01&to=2026-09-28");
    const funnelHeading = page.getByRole("heading", { name: "Funnel by ad" });
    const trendsHeading = page.getByRole("heading", { name: "Trends" });
    await expect(funnelHeading).toBeVisible({ timeout: 30_000 });

    const funnelBox = await funnelHeading.boundingBox();
    const trendsBox = await trendsHeading.boundingBox();
    expect(funnelBox!.y).toBeLessThan(trendsBox!.y);

    const table = page.locator("section", { has: funnelHeading }).locator("table");
    const headers = await table.locator("thead th").allTextContents();
    for (const header of ["LP Visitors", "Website Opt-ins", "Qualified Opt-ins", "Calls Booked", "Qualified Calls Booked", "Qualified Showups", "Cost / Opt-in"]) {
      expect(headers).toContain(header);
    }

    const campaignButtons = table.locator("tbody button[aria-expanded]");
    const before = await table.locator("tbody tr").count();
    await campaignButtons.first().click();
    await expect.poll(() => table.locator("tbody tr").count()).toBeGreaterThan(before);

    await page.screenshot({ path: "test-results/meta-ads-funnel.png", fullPage: false });
  });
});
