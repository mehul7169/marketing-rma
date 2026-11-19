import { test, expect, type Page, type Locator } from "@playwright/test";
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

async function ensureContactColumns(page: Page) {
  const needPhone = (await page.getByTestId("copy-phone").count()) === 0;
  const needEmail = (await page.getByTestId("copy-email").count()) === 0;
  if (!needPhone && !needEmail) return;
  await page.getByRole("button", { name: "Columns" }).click();
  for (const id of ["phone", "email"] as const) {
    const checkbox = page.locator(`#col-${id}`);
    await expect(checkbox).toBeVisible();
    if (!(await checkbox.isChecked())) await checkbox.check();
  }
  await page.getByRole("button", { name: "Columns" }).click();
  await expect(page.getByTestId("copy-phone").first()).toBeAttached({ timeout: 10_000 });
  await expect(page.getByTestId("copy-email").first()).toBeAttached({ timeout: 10_000 });
}

async function copyContact(page: Page, scope: Locator, testId: "copy-phone" | "copy-email") {
  const btn = scope.getByTestId(testId).first();
  await scope.hover();
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ force: true });
  await expect(btn).toHaveAttribute("aria-label", "Copied");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.length).toBeGreaterThan(0);
  await expect(page.getByTestId("lead-drawer")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("lead")).toBeNull();
  return text;
}

test.describe("Work Queue copy email/phone", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("table and cards copy phone then email without opening the drawer", async ({
    page
  }) => {
    await login(page);

    await page.goto("/leads/queue?view=table");
    await waitQueue(page);
    await ensureContactColumns(page);
    const row = page
      .getByTestId("work-queue-row")
      .filter({ has: page.locator('[data-testid="copy-phone"]') })
      .filter({ has: page.locator('[data-testid="copy-email"]') })
      .first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    const tablePhone = await copyContact(page, row, "copy-phone");
    const tableEmail = await copyContact(page, row, "copy-email");
    expect(tableEmail).not.toBe(tablePhone);

    await page.getByRole("button", { name: "Cards" }).click();
    await expect(page.getByTestId("work-queue-card").first()).toBeVisible({
      timeout: 20_000
    });
    const card = page
      .getByTestId("work-queue-card")
      .filter({ has: page.getByTestId("copy-phone") })
      .filter({ has: page.getByTestId("copy-email") })
      .first();
    await expect(card).toBeVisible();
    const cardPhone = await copyContact(page, card, "copy-phone");
    const cardEmail = await copyContact(page, card, "copy-email");
    expect(cardEmail).not.toBe(cardPhone);
  });
});
