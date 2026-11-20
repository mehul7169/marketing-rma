import { test, expect, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

const email = process.env.E2E_MEMBER_EMAIL || process.env.TEST_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD || process.env.TEST_MEMBER_PASSWORD;
const OUT = path.join("e2e", "screenshots", "toolbar");

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

function encodeCf(): string {
  const wire = {
    m: "all",
    c: [
      { f: "first_contacted_at", o: "is_empty" },
      { f: "created_at", o: "after", v: "2026-11-01" }
    ]
  };
  return Buffer.from(JSON.stringify(wire)).toString("base64url");
}

async function shot(page: Page, file: string) {
  mkdirSync(OUT, { recursive: true });
  const h1 = await page.locator("h1").boundingBox();
  const chrome = await page
    .getByTestId("queue-controls")
    .or(page.getByTestId("leads-filters"))
    .boundingBox();
  const boxes = [h1, chrome].filter((b): b is NonNullable<typeof b> => Boolean(b));
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - 8);
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - 8);
  const pop = page.getByTestId("cf-popover");
  const popBox = (await pop.count()) ? await pop.boundingBox() : null;
  const all = popBox ? [...boxes, popBox] : boxes;
  const right = Math.max(...all.map((b) => b.x + b.width)) + 8;
  const bottom = Math.max(...all.map((b) => b.y + b.height)) + 8;
  await page.screenshot({
    path: path.join(OUT, file),
    clip: { x, y, width: right - x, height: bottom - y }
  });
}

test.describe("Work Queue / leads toolbar screenshots", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");
  test.setTimeout(180_000);

  test("header at 1440 / 1024 / 768 with 0 filters, 2 filters, and popover", async ({
    page
  }) => {
    await login(page);
    const cf = encodeCf();

    for (const width of [1440, 1024, 768] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/leads/queue?view=table");
      await waitQueue(page);
      await shot(page, `wq-0-filters-${width}.png`);

      await page.goto(`/leads/queue?view=table&cf=${cf}`);
      await waitQueue(page);
      await expect(page.locator('[data-testid^="filter-chip-cf:"]')).toHaveCount(2);
      await shot(page, `wq-2-filters-${width}.png`);

      await page.getByTestId("cf-filter").click();
      await expect(page.getByTestId("cf-popover")).toBeVisible();
      await shot(page, `wq-popover-${width}.png`);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/leads?dead=hide");
    await expect(page.getByTestId("leads-search")).toBeVisible({ timeout: 20_000 });
    await shot(page, "leads-1440.png");
  });
});
