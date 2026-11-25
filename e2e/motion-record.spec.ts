import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

const email = process.env.E2E_MEMBER_EMAIL || process.env.TEST_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD || process.env.TEST_MEMBER_PASSWORD;
const OUT = path.join("e2e", "screenshots", "motion");

test.use({
  video: { mode: "on", size: { width: 1280, height: 720 } },
  contextOptions: { reducedMotion: "no-preference" }
});

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function rmaOrgId(): Promise<string> {
  const db = admin();
  for (const slug of ["rma", "rma-marketing"]) {
    const { data } = await db.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (data?.id) return String(data.id);
  }
  throw new Error("RMA org not found");
}

async function profileByEmail(addr: string) {
  const { data, error } = await admin()
    .from("profiles")
    .select("id,email")
    .eq("email", addr)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error(`No profile for ${addr}`);
  return { id: String(data.id), email: String(data.email) };
}

async function deleteLead(leadId: string, orgId: string) {
  const db = admin();
  await db.from("lead_activities").delete().eq("lead_id", leadId).eq("org_id", orgId);
  await db.from("leads").delete().eq("id", leadId).eq("org_id", orgId);
}

async function seedDeal(orgId: string, ownerId: string, stamp: number) {
  const db = admin();
  const name = `Motion e2e ${stamp}`;
  const { data, error } = await db
    .from("leads")
    .insert({
      org_id: orgId,
      email: `motion-ui2-${stamp}@manual.invalid`,
      name,
      phone: `998${String(stamp).slice(-7)}`,
      lead_source: "manual",
      form_qualified: true,
      call_booked_at: new Date().toISOString(),
      call_scheduled_for: new Date(Date.now() + 86400000).toISOString(),
      call_showed: true,
      call_showed_at: new Date().toISOString(),
      owner_id: ownerId,
      deal_closed: null,
      next_step: null,
      next_action_at: null,
      is_dead: false
    })
    .select("id,name")
    .single();
  if (error) throw error;
  return { id: String(data.id), name: String(data.name) };
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function copyRecording(page: Page, title: string) {
  mkdirSync(OUT, { recursive: true });
  const video = page.video();
  await page.close();
  if (!video) return;
  const src = await video.path();
  copyFileSync(src, path.join(OUT, `${title.replace(/\s+/g, "-")}.webm`));
}

test.describe("motion recordings", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");
  test.setTimeout(120_000);

  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "recordings run on chromium only");
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === "skipped") return;
    await copyRecording(page, testInfo.title);
  });

  test("home load", async ({ page }) => {
    await login(page);
    await page.goto("/");
    await expect(page.getByText("Booked Rate")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1200);
  });

  test("work queue tab switch", async ({ page }) => {
    await login(page);
    await page.goto("/leads/queue?view=table");
    await expect(page.getByTestId("queue-controls")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("queue-tab-follow_ups_due").click();
    await expect(page.getByTestId("queue-tab-follow_ups_due")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.waitForTimeout(600);
    await page.getByTestId("queue-tab-all").click();
    await expect(page.getByTestId("queue-tab-all")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.waitForTimeout(400);
  });

  test("deals follow-up and drawer", async ({ page }) => {
    const orgId = await rmaOrgId();
    const member = await profileByEmail(email!);
    const stamp = Date.now();
    const seeded = await seedDeal(orgId, member.id, stamp);
    try {
      await login(page);
      await page.goto("/deals?tab=open");
      await expect(page.getByTestId("deals-controls")).toBeVisible({
        timeout: 20_000
      });
      await page.getByTestId("deals-search").fill(seeded.name);
      await page.getByTestId("deals-search").press("Enter");
      const row = page.locator("tr", { hasText: seeded.name }).first();
      await expect(row).toBeVisible({ timeout: 20_000 });
      await row.hover();
      await row.getByTestId("deal-log-follow-up").click({ force: true });
      await expect(page.getByTestId("log-follow-up-form")).toBeVisible({
        timeout: 10_000
      });
      await page.getByTestId("follow-up-outcome-spoke").click();
      await page.getByTestId("follow-up-next-Call").click();
      await page.getByTestId("follow-up-when-tomorrow_11").click();
      await page.getByTestId("follow-up-save").click();
      await expect(page.getByTestId("deals-group-tomorrow")).toContainText(
        seeded.name,
        { timeout: 15_000 }
      );
      await page.waitForTimeout(500);

      await page.locator("tr", { hasText: seeded.name }).first().click();
      await expect(page.getByTestId("deal-drawer")).toBeVisible();
      await page.waitForTimeout(400);
      const t0 = Date.now();
      await page.getByTestId("deal-drawer-backdrop").click();
      await expect(page.getByTestId("deal-drawer")).toBeHidden({ timeout: 100 });
      expect(Date.now() - t0).toBeLessThan(100);
    } finally {
      await deleteLead(seeded.id, orgId);
    }
  });

  test("lead drawer open close", async ({ page }) => {
    await login(page);
    await page.goto("/leads/queue?view=table");
    const name = page.locator("table tbody tr td:first-child button");
    await expect(name.first()).toBeVisible({ timeout: 20_000 });
    await name.first().click();
    await expect(page.getByTestId("lead-drawer")).toBeVisible();
    await page.waitForTimeout(400);
    const t0 = Date.now();
    await page.getByTestId("lead-drawer-close").click();
    await expect(page.getByTestId("lead-drawer")).toBeHidden({ timeout: 100 });
    expect(Date.now() - t0).toBeLessThan(100);
  });
});
