import { test, expect, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

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

async function pickField(page: Page, label: string) {
  await page.getByTestId("cf-field").last().selectOption({ label });
}

function cfParam(page: Page): string | null {
  return new URL(page.url()).searchParams.get("cf");
}

test.describe("custom filter builder", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test("apply two conditions, reload, save, reapply, remove one chip", async ({ page }) => {
    await login(page);
    await page.goto("/leads/queue?view=table");
    await waitQueue(page);

    await page.getByTestId("cf-filter").click();
    await expect(page.getByTestId("cf-popover")).toBeVisible();
    await pickField(page, "Form Qualified");
    await page.getByTestId("cf-add").click();
    await pickField(page, "Call booked at");
    await page.getByTestId("cf-op").last().selectOption("is_not_empty");
    await expect(page.locator('[data-testid^="filter-chip-cf:"]')).toHaveCount(2, {
      timeout: 20_000
    });
    await page.waitForURL(/[?&]cf=/, { timeout: 20_000 });
    await waitQueue(page);

    const encoded = cfParam(page);
    expect(encoded).toBeTruthy();
    const totalAfter = await page.getByTestId("queue-pagination").getAttribute("data-total");
    await expect(page.locator('[data-testid^="filter-chip-cf:"]')).toHaveCount(2);

    await page.reload();
    await waitQueue(page);
    expect(cfParam(page)).toBe(encoded);
    expect(await page.getByTestId("queue-pagination").getAttribute("data-total")).toBe(totalAfter);
    await expect(page.getByTestId("cf-yield-note")).toContainText("Form Qualified");

    const savedName = `E2E form-qualified booked ${Date.now()}`;
    await page.getByTestId("cf-saved").click();
    await page.getByTestId("cf-save-as").click();
    await page.getByTestId("cf-save-name").fill(savedName);
    await page.getByTestId("cf-save-confirm").click();
    await expect(page.getByText(savedName)).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("cf-saved").click();

    await page.getByRole("button", { name: "Clear" }).click();
    await waitQueue(page);
    await expect.poll(() => cfParam(page)).toBeNull();

    await page.getByTestId("cf-saved").click();
    await page.getByText(savedName, { exact: true }).click();
    await page.waitForURL(/[?&]cf=/, { timeout: 20_000 });
    await waitQueue(page);
    expect(cfParam(page)).toBe(encoded);
    expect(await page.getByTestId("queue-pagination").getAttribute("data-total")).toBe(totalAfter);

    const chips = page.locator('[data-testid^="filter-chip-cf:"]');
    await expect(chips).toHaveCount(2);
    await chips.nth(0).getByRole("button", { name: /Remove/ }).click();
    await waitQueue(page);
    await expect(page.locator('[data-testid^="filter-chip-cf:"]')).toHaveCount(1);
    expect(cfParam(page)).toBeTruthy();
    expect(cfParam(page)).not.toBe(encoded);
  });
});
