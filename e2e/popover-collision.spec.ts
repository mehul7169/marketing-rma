import { test, expect, type Page } from "@playwright/test";

const email = process.env.E2E_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

function popover(page: Page) {
  return page.locator("[data-action-popover]");
}

async function assertFullyOnScreen(
  page: Page,
  box: { x: number; y: number; width: number; height: number }
) {
  const vp = page.viewportSize();
  expect(vp).toBeTruthy();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(vp!.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(vp!.height + 1);
}

test.describe("action popover collision", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");

  test("Log call on the last Work Queue card flips above at 768px", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 768 });
    await login(page);
    await page.goto("/leads/queue?view=cards&dead=hide");
    const logCall = page.getByRole("button", { name: "Log Call" });
    await expect(logCall.first()).toBeVisible({ timeout: 20_000 });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const last = logCall.last();
    await last.scrollIntoViewIfNeeded();
    const btn = await last.boundingBox();
    expect(btn).toBeTruthy();
    await last.click();

    const panel = popover(page);
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).toBeTruthy();
    await assertFullyOnScreen(page, box!);
    if (btn!.y > 768 / 2) {
      expect(box!.y + box!.height).toBeLessThanOrEqual(btn!.y + 8);
    }

    const save = panel.getByRole("button", { name: "Save" });
    await expect(save).toBeVisible();
    const saveBox = await save.boundingBox();
    expect(saveBox).toBeTruthy();
    await assertFullyOnScreen(page, saveBox!);
    await save.click({ trial: true });
  });

  test("Stage Actions and confirm on the last grid row stay on screen", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 768 });
    await login(page);
    await page.goto("/leads?dead=hide");
    const actions = page.getByRole("button", { name: "Actions" });
    await expect(actions.first()).toBeVisible({ timeout: 20_000 });

    const last = actions.last();
    await last.scrollIntoViewIfNeeded();
    const btn = await last.boundingBox();
    expect(btn).toBeTruthy();
    await last.click();

    const menu = popover(page);
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox).toBeTruthy();
    await assertFullyOnScreen(page, menuBox!);
    if (btn!.y > 768 / 2) {
      expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(btn!.y + 8);
    }

    const parent = await menu.evaluate((el) => el.parentElement?.tagName);
    expect(parent).toBe("BODY");

    await menu.getByRole("menuitem", { name: "Mark dead" }).click();
    const confirm = popover(page);
    await expect(confirm).toBeVisible();
    const confirmBox = await confirm.boundingBox();
    expect(confirmBox).toBeTruthy();
    await assertFullyOnScreen(page, confirmBox!);
    await expect(
      confirm.getByRole("button", { name: "Mark dead" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("narrow viewport shifts the popover horizontally and resize repositions", async ({
    page
  }) => {
    await page.setViewportSize({ width: 500, height: 640 });
    await login(page);
    await page.goto("/leads/queue?view=cards&dead=hide");
    const logCall = page.getByRole("button", { name: "Log Call" }).first();
    await expect(logCall).toBeVisible({ timeout: 20_000 });
    await logCall.click({ force: true });

    const panel = popover(page);
    await expect(panel).toBeVisible();
    const before = await panel.boundingBox();
    expect(before).toBeTruthy();
    await assertFullyOnScreen(page, before!);

    await page.setViewportSize({ width: 900, height: 500 });
    await page.waitForTimeout(50);
    const after = await panel.boundingBox();
    expect(after).toBeTruthy();
    await assertFullyOnScreen(page, after!);
  });
});
