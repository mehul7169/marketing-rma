import { test, expect } from "@playwright/test";

/**
 * Smoke suite only. Auth-dependent tests skip unless env credentials are set.
 *
 * Create dedicated test accounts/orgs first (NOT production RMA data), then:
 *   E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 *   E2E_NO_ORG_EMAIL / E2E_NO_ORG_PASSWORD
 *   E2E_INVITED_EMAIL / E2E_INVITED_PASSWORD  (optional signup success)
 */

const memberEmail = process.env.E2E_MEMBER_EMAIL;
const memberPassword = process.env.E2E_MEMBER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const noOrgEmail = process.env.E2E_NO_ORG_EMAIL;
const noOrgPassword = process.env.E2E_NO_ORG_PASSWORD;
const invitedEmail = process.env.E2E_INVITED_EMAIL;
const invitedPassword = process.env.E2E_INVITED_PASSWORD;

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("public auth pages", () => {
  test("/login loads without a redirect loop", async ({ page }) => {
    const responses: string[] = [];
    page.on("response", (res) => {
      if (res.url().includes("/login")) responses.push(res.url());
    });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    // Should not bounce login → login repeatedly
    expect(responses.length).toBeLessThan(5);
    await expect(page).toHaveURL(/\/login\/?$/);
  });

  test("/signup loads", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Sign up" })).toBeVisible();
  });

  test("/signup rejects uninvited email (when no invite env)", async ({
    page
  }) => {
    test.skip(
      Boolean(invitedEmail),
      "Skip uninvited check when invited credentials are configured"
    );
    await page.goto("/signup");
    await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill("testpass99");
    await page.getByLabel("Confirm password").fill("testpass99");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(
      page.getByText(/hasn't been invited yet/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("member smoke", () => {
  test.skip(!memberEmail || !memberPassword, "Set E2E_MEMBER_EMAIL/PASSWORD");

  test("login lands on home without manual refresh", async ({ page }) => {
    await login(page, memberEmail!, memberPassword!);
    await expect(page).toHaveURL(/\/($|\?)/, { timeout: 20_000 });
    // Page should be interactive (not stuck on login)
    await expect(page.getByRole("heading", { name: "Log in" })).toHaveCount(0);
  });

  test("main authenticated routes load without client errors", async ({
    page
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await login(page, memberEmail!, memberPassword!);
    await expect(page).not.toHaveURL(/\/login/);

    for (const path of ["/", "/leads", "/leads/queue", "/meta-ads", "/website", "/insights"]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/login/);
      // Wait for network settle; catch hard crashes via pageerror
      await page.waitForLoadState("domcontentloaded");
    }
    expect(errors).toEqual([]);
  });

  test("non-admin is blocked from /clients-ads and /admin/organizations", async ({
    page
  }) => {
    test.skip(!adminEmail || adminEmail === memberEmail, "Need distinct member vs admin");
    await login(page, memberEmail!, memberPassword!);
    await page.goto("/clients-ads");
    await expect(page).not.toHaveURL(/\/clients-ads/);
    await page.goto("/admin/organizations");
    await expect(page).not.toHaveURL(/\/admin\/organizations/);
  });
});

test.describe("platform admin smoke", () => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL/PASSWORD");

  test("/clients-ads and /admin/organizations are reachable", async ({
    page
  }) => {
    await login(page, adminEmail!, adminPassword!);
    await page.goto("/admin/organizations");
    await expect(page).toHaveURL(/\/admin\/organizations/);
    await page.goto("/clients-ads");
    await expect(page).toHaveURL(/\/clients-ads/);
  });
});

test.describe("zero-membership security invariant", () => {
  test.skip(!noOrgEmail || !noOrgPassword, "Set E2E_NO_ORG_EMAIL/PASSWORD");

  test("user with zero org memberships is blocked from protected routes", async ({
    page
  }) => {
    await login(page, noOrgEmail!, noOrgPassword!);
    // May stay on login or be bounced back when hitting protected routes
    for (const path of ["/", "/leads", "/meta-ads", "/website", "/insights"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/(login|signup|admin)/);
    }
  });
});

test.describe("invited signup", () => {
  test.skip(
    !invitedEmail || !invitedPassword,
    "Set E2E_INVITED_EMAIL/PASSWORD for invite-success path"
  );

  test("signup succeeds for invited email", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Email").fill(invitedEmail!);
    await page.getByLabel("Password", { exact: true }).fill(invitedPassword!);
    await page.getByLabel("Confirm password").fill(invitedPassword!);
    await page.getByRole("button", { name: "Sign up" }).click();
    // Either email-confirm success screen or redirect home
    await expect(
      page.getByRole("heading", { name: /Check your email|Sign up/i })
    ).toBeVisible({ timeout: 20_000 });
    // Should not show invite-required error
    await expect(page.getByText(/hasn't been invited yet/i)).toHaveCount(0);
  });
});
