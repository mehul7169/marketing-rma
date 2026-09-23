import { test, expect, type Page } from "@playwright/test";

/**
 * Create Lead UI — never submits a valid form, so no rows are written.
 * Uses the same E2E_* credentials as smoke.spec.ts.
 */

const memberEmail = process.env.E2E_MEMBER_EMAIL;
const memberPassword = process.env.E2E_MEMBER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

test.describe("Create Lead (member)", () => {
  test.skip(!memberEmail || !memberPassword, "Set E2E_MEMBER_EMAIL/PASSWORD");

  test("button is enabled and required fields block submit inline", async ({ page }) => {
    await login(page, memberEmail!, memberPassword!);
    await page.goto("/leads/queue");
    const button = page.getByRole("button", { name: "Create Lead" });
    await expect(button).toBeEnabled();
    await button.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/Source/)).toHaveValue("referral");
    await dialog.getByRole("button", { name: "Create lead" }).click();
    await expect(dialog.getByText("Name is required.")).toBeVisible();
    await expect(dialog.getByText("Phone is required.")).toBeVisible();

    await dialog.getByLabel(/Name/).fill("E2E never submitted");
    await dialog.getByLabel(/Phone/).fill("123");
    await dialog.getByRole("button", { name: "Create lead" }).click();
    await expect(dialog.getByText("Phone must have at least 7 digits.")).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("Create Lead (platform admin preview)", () => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL/PASSWORD");

  test("button is disabled during org preview", async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
    await page.goto("/leads/queue");
    const switcher = page.locator("#org-preview-switcher");
    await page.waitForLoadState("networkidle");
    test.skip((await switcher.count()) === 0, "E2E_ADMIN user is not a platform admin");
    const options = switcher.locator("option:not([disabled])");
    const orgId = await options.first().getAttribute("value");
    test.skip(!orgId, "No orgs to preview");
    await switcher.selectOption(orgId!);
    await expect(page.getByRole("button", { name: "Exit preview" })).toBeVisible({
      timeout: 20_000
    });

    const button = page.getByRole("button", { name: "Create Lead" });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("title", /Read-only preview/);

    await page.getByRole("button", { name: "Exit preview" }).click();
    await expect(page.getByRole("button", { name: "Exit preview" })).toHaveCount(0, {
      timeout: 20_000
    });
  });
});
