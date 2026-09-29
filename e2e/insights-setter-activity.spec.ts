import { test, expect, type Locator } from "@playwright/test";

/** /insights "Setter activity" — read-only, no writes. */

const email = process.env.E2E_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD;

async function footerCounts(table: Locator): Promise<string[]> {
  return (await table.locator("tfoot td").allTextContents()).slice(1);
}

test.describe("Insights setter activity", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");

  test("org-level and per-setter totals match", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goto("/insights?from=2026-09-14&to=2026-09-29");
    const heading = page.getByRole("heading", { name: "Setter activity" });
    await expect(heading).toBeVisible({ timeout: 30_000 });

    const section = page.locator("section", { has: heading });
    const [orgTable, userTable] = [section.locator("table").nth(0), section.locator("table").nth(1)];
    const headers = await orgTable.locator("thead th").allTextContents();
    expect(headers).toEqual(["Date (IST)", "Total Dials", "Calls Booked", "No Answer", "Unqualified", "Follow-up"]);

    const orgTotals = await footerCounts(orgTable);
    if (orgTotals.length > 0) {
      expect(await footerCounts(userTable)).toEqual(orgTotals);
    }

    await section.screenshot({ path: "test-results/insights-setter-activity.png" });
  });
});
