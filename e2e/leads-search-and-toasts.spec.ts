import { test, expect, type Page } from "@playwright/test";

/**
 * Search + disabled Mark showed. Rejected actions don't write.
 * Does not create or mutate leads.
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

function qParam(page: Page): string | null {
  return new URL(page.url()).searchParams.get("q");
}

async function waitSearchSettled(page: Page) {
  await expect(page.getByTestId("search-pending")).toHaveCount(0, {
    timeout: 20_000
  });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 20_000
  });
}

function nameButtons(page: Page) {
  return page.locator("table tbody tr td:first-child button");
}

async function assertResultsMatch(page: Page, q: string) {
  const empty = page.getByText(/No leads in this filter/i);
  const names = nameButtons(page);
  await expect(names.first().or(empty)).toBeVisible({ timeout: 20_000 });
  expect(await empty.count(), `expected rows for q=${q}`).toBe(0);
  const texts = await names.allTextContents();
  expect(texts.length).toBeGreaterThan(0);
  for (const t of texts) {
    expect(t.toLowerCase()).toContain(q.toLowerCase());
  }
  return texts.length;
}

async function searchEnter(page: Page, q: string) {
  const input = page.getByTestId("leads-search");
  await input.fill(q);
  const pendingVisible = page
    .getByTestId("search-pending")
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  await input.press("Enter");
  const sawSpinner = await pendingVisible;
  expect(
    sawSpinner,
    "search spinner should appear after Enter"
  ).toBe(true);
  await expect.poll(() => qParam(page), { timeout: 20_000 }).toBe(q);
  await expect(input).toHaveValue(q);
  await expect(page.getByTestId("filter-chip-q")).toContainText(`Search: ${q}`);
  await waitSearchSettled(page);
}

test.describe("leads search and showed-up guard", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");
  test.setTimeout(120_000);

  test("Enter once, chip/URL/input agree, Back and chip remove", async ({
    page
  }) => {
    await login(page);
    await page.goto("/leads?dead=hide&from=2024-01-01&to=2026-10-28");
    await expect(page.getByTestId("leads-search")).toBeVisible({
      timeout: 20_000
    });
    await expect(nameButtons(page).first()).toBeVisible({ timeout: 20_000 });

    await searchEnter(page, "kunal");
    const kunalCount = await assertResultsMatch(page, "kunal");

    await searchEnter(page, "piyush");
    await assertResultsMatch(page, "piyush");

    await page.goBack();
    await expect.poll(() => qParam(page), { timeout: 20_000 }).toBe("kunal");
    await expect(page.getByTestId("leads-search")).toHaveValue("kunal");
    await expect(page.getByTestId("filter-chip-q")).toContainText("Search: kunal");
    await waitSearchSettled(page);
    await assertResultsMatch(page, "kunal");

    await page.getByRole("button", { name: "Remove Search: kunal" }).click();
    await expect.poll(() => qParam(page), { timeout: 20_000 }).toBeNull();
    await expect(page.getByTestId("leads-search")).toHaveValue("");
    await expect(page.getByTestId("filter-chip-q")).toHaveCount(0);
    await waitSearchSettled(page);
    const allRows = await nameButtons(page).count();
    expect(allRows).toBeGreaterThan(kunalCount);
  });

  test("fast typing settles on the latest query", async ({ page }) => {
    await login(page);
    await page.goto("/leads?dead=hide&from=2024-01-01&to=2026-10-28");
    const input = page.getByTestId("leads-search");
    await expect(input).toBeVisible({ timeout: 20_000 });
    await input.click();
    await input.pressSequentially("kunal", { delay: 40 });
    await expect.poll(() => qParam(page), { timeout: 20_000 }).toBe("kunal");
    await expect(input).toHaveValue("kunal");
    await waitSearchSettled(page);
    await assertResultsMatch(page, "kunal");
  });

  test("Showed Up Yes is disabled without a booking when Stage is hidden", async ({
    page
  }) => {
    await login(page);
    await page.goto(
      "/leads?dead=hide&stage=contacted&from=2024-01-01&to=2026-10-28"
    );
    await expect(page.getByRole("button", { name: "Columns" })).toBeVisible({
      timeout: 20_000
    });

    await page.getByRole("button", { name: "Columns" }).click();
    const stage = page.locator("#col-stage");
    await expect(stage).toBeVisible();
    if (await stage.isChecked()) {
      await page.locator('label[for="col-stage"]').click();
    }
    await expect(stage).not.toBeChecked();
    await page.keyboard.press("Escape");

    const blocked = page
      .getByTestId("call-showed-yesno")
      .locator('button[data-value="yes"][title="Book a call before marking it as showed."]');
    await expect(blocked.first()).toBeVisible({ timeout: 20_000 });
    await expect(blocked.first()).toBeDisabled();
  });
});
