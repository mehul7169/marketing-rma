import { test, expect, type Page, type Request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

const email = process.env.E2E_MEMBER_EMAIL || process.env.TEST_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD || process.env.TEST_MEMBER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD;
const OUT = path.join("e2e", "screenshots", "deals");

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

async function sqlCounts(orgId: string) {
  const db = admin();
  const showed = () =>
    db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("call_showed", true);
  const [open, won, lost, all] = await Promise.all([
    showed().is("deal_closed", null),
    showed().eq("deal_closed", true),
    showed().eq("deal_closed", false),
    showed()
  ]);
  return {
    open: open.count ?? 0,
    won: won.count ?? 0,
    lost: lost.count ?? 0,
    all: all.count ?? 0
  };
}

async function needsNextStepCount(orgId: string): Promise<number> {
  const { count, error } = await admin()
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("call_showed", true)
    .is("deal_closed", null)
    .or("next_step.is.null,next_action_at.is.null");
  if (error) throw error;
  return count ?? 0;
}

async function deleteLead(leadId: string, orgId: string) {
  const db = admin();
  await db.from("lead_activities").delete().eq("lead_id", leadId).eq("org_id", orgId);
  await db.from("leads").delete().eq("id", leadId).eq("org_id", orgId);
}

async function deleteLeftoverDeals2Leads(orgId: string) {
  const db = admin();
  const { data } = await db
    .from("leads")
    .select("id")
    .eq("org_id", orgId)
    .like("email", "deals-p2-%@manual.invalid");
  for (const row of data ?? []) {
    await deleteLead(String((row as { id: string }).id), orgId);
  }
}

async function seedDeal(orgId: string, ownerId: string, stamp: number) {
  const db = admin();
  const name = `Deals 2 e2e ${stamp}`;
  const { data, error } = await db
    .from("leads")
    .insert({
      org_id: orgId,
      email: `deals-p2-${stamp}@manual.invalid`,
      name,
      phone: `999${String(stamp).slice(-7)}`,
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

async function login(page: Page, user: string, pass: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user);
  await page.getByLabel("Password").fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function waitDeals(page: Page) {
  await expect(page.getByTestId("deals-controls")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
}

async function openDeal(page: Page, name: string) {
  await page.getByTestId("deals-search").fill(name);
  await page.getByTestId("deals-search").press("Enter");
  await waitDeals(page);
  const row = page.locator("tr", { hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  return row;
}

function isListRsc(req: Request): boolean {
  const url = req.url();
  if (!url.includes("/deals")) return false;
  if (url.includes("/api/")) return false;
  const h = req.headers();
  if (h.rsc === "1") return true;
  try {
    if (new URL(url).searchParams.has("_rsc")) return true;
  } catch {
    return false;
  }
  return false;
}

test.describe.serial("Deals tab", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");
  test.setTimeout(180_000);

  let orgId = "";
  let leadId = "";
  let leadName = "";
  let stamp = 0;
  let triageCount = 0;

  test.afterAll(async () => {
    if (leadId && orgId) await deleteLead(leadId, orgId);
  });

  test("opens on Open with org counts matching SQL", async ({ page }) => {
    orgId = await rmaOrgId();
    await deleteLeftoverDeals2Leads(orgId);
    const member = await profileByEmail(email!);
    stamp = Date.now();
    const seeded = await seedDeal(orgId, member.id, stamp);
    leadId = seeded.id;
    leadName = seeded.name;
    triageCount = await needsNextStepCount(orgId);
    // eslint-disable-next-line no-console
    console.log(`RMA triage banner count: ${triageCount}`);

    await login(page, email!, password!);
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("deals-triage-dismissed:")) localStorage.removeItem(k);
      }
    });
    const sql = await sqlCounts(orgId);
    await page.goto("/deals?tab=open");
    await waitDeals(page);
    await expect(page.getByTestId("deals-tab-open")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("deals-count-open")).toHaveText(String(sql.open));
    await expect(page.getByTestId("deals-count-won")).toHaveText(String(sql.won));
    await expect(page.getByTestId("deals-count-lost")).toHaveText(String(sql.lost));
    await expect(page.getByTestId("deals-count-all")).toHaveText(String(sql.all));
    if (triageCount > 0) {
      await expect(page.getByTestId("deals-triage-banner")).toContainText(
        `${triageCount} deal`
      );
    }
  });

  test("log follow-up moves Needs next step → Tomorrow and shows on the timeline", async ({
    page
  }) => {
    await login(page, email!, password!);
    await page.goto("/deals?tab=open");
    await waitDeals(page);
    const row = await openDeal(page, leadName);
    await expect(page.getByTestId("deals-group-needs_next_step")).toBeVisible();
    await row.hover();
    await row.getByTestId("deal-log-follow-up").click({ force: true });
    await expect(page.getByTestId("log-follow-up-form")).toBeVisible({
      timeout: 10_000
    });
    await page.getByTestId("follow-up-outcome-spoke").click();
    await page.getByTestId("follow-up-next-Call").click();
    await page.getByTestId("follow-up-when-tomorrow_11").click();
    await page.getByTestId("follow-up-save").click();
    await expect(page.getByTestId("deals-group-tomorrow")).toContainText(leadName, {
      timeout: 15_000
    });
    await page.locator("tr", { hasText: leadName }).first().click();
    await expect(page.getByTestId("deal-drawer")).toBeVisible();
    await expect(page.getByTestId("deal-activity-follow-up")).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByTestId("deal-activity-follow-up")).toContainText(/spoke/i);
  });

  test("past next step with confirm lands in Overdue and increments the badge", async ({
    page
  }) => {
    await login(page, email!, password!);
    await page.goto("/deals?tab=open");
    await waitDeals(page);
    const badgeBefore = await page.getByTestId("nav-deals-overdue").count();
    const badgeText =
      badgeBefore === 0
        ? "0"
        : (await page.getByTestId("nav-deals-overdue").innerText()).trim();
    const row = await openDeal(page, leadName);
    await row.hover();
    await row.getByTestId("deal-log-follow-up").click();
    await page.getByTestId("follow-up-outcome-spoke").click();
    await page.getByTestId("follow-up-next-Call").click();
    const past = "2020-01-01T11:00";
    await page.getByTestId("follow-up-when").fill(past);
    await page.getByTestId("follow-up-confirm-past").check();
    await page.getByTestId("follow-up-save").click();
    await expect(page.getByTestId("deals-group-overdue")).toContainText(leadName, {
      timeout: 15_000
    });
    await expect(page.getByTestId("nav-deals-overdue")).toBeVisible({ timeout: 20_000 });
    if (badgeText !== "0") {
      const next = Number(badgeText.replace("+", ""));
      if (!Number.isNaN(next) && next < 99) {
        await expect(page.getByTestId("nav-deals-overdue")).toHaveText(String(next + 1));
      }
    }
  });

  test("mark lost requires a reason; reopen requires reason + next step", async ({
    page
  }) => {
    await login(page, email!, password!);
    await page.goto("/deals?tab=open");
    await waitDeals(page);
    const row = await openDeal(page, leadName);
    await row.hover();
    await row.getByTestId("deal-more").click();
    await page.getByTestId("deal-mark-lost").click();
    await page.getByTestId("follow-up-save").click();
    await expect(page.getByTestId("follow-up-error")).toBeVisible();
    await page.getByTestId("follow-up-lost-price").click();
    await page.getByTestId("follow-up-save").click();
    await expect(page.locator("tr", { hasText: leadName })).toHaveCount(0, {
      timeout: 15_000
    });
    await page.getByTestId("deals-tab-lost").click();
    await waitDeals(page);
    const lostRow = await openDeal(page, leadName);
    await lostRow.hover();
    await lostRow.getByTestId("deal-reopen").click();
    await page.getByTestId("reopen-save").click();
    await expect(page.getByTestId("reopen-error")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("reopen-reason").fill("reopen for e2e");
    await page.getByTestId("reopen-next-step").fill("Call");
    await page.getByTestId("reopen-save").click();
    await page.getByTestId("deals-tab-open").click();
    await waitDeals(page);
    await expect(page.locator("tr", { hasText: leadName })).toBeVisible({
      timeout: 15_000
    });
  });

  test("mark won with a value appears in Won and Insights won +1", async ({
    page
  }) => {
    await login(page, email!, password!);
    await page.goto("/insights");
    await expect(page.getByTestId("insights-won-count")).toBeVisible({ timeout: 20_000 });
    const before = Number(
      (await page.getByTestId("insights-won-count").innerText()).replace(/,/g, "")
    );
    await page.goto("/deals?tab=open");
    await waitDeals(page);
    const row = await openDeal(page, leadName);
    await row.hover();
    await row.getByTestId("deal-more").click();
    await page.getByTestId("deal-mark-won").click();
    await page.getByTestId("follow-up-value").fill("1500");
    await page.getByTestId("follow-up-save").click();
    await page.getByTestId("deals-tab-won").click();
    await waitDeals(page);
    await expect(page.locator("tr", { hasText: leadName })).toBeVisible({
      timeout: 15_000
    });
    await page.goto("/insights");
    await expect(page.getByTestId("insights-won-count")).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => {
      const text = (await page.getByTestId("insights-won-count").innerText()).replace(
        /,/g,
        ""
      );
      return Number(text);
    }).toBe(before + 1);
  });

  test("opening and closing the drawer does not refetch the list", async ({
    page
  }) => {
    await login(page, email!, password!);
    await page.goto("/deals?tab=won");
    await waitDeals(page);
    const row = await openDeal(page, leadName);
    const rsc: string[] = [];
    page.on("request", (req) => {
      if (isListRsc(req)) rsc.push(req.url());
    });
    await row.click();
    const drawer = page.getByTestId("deal-drawer");
    await expect(drawer).toBeVisible();
    expect(new URL(page.url()).searchParams.get("deal")).toBeTruthy();
    expect(rsc, "opening must not refetch RSC list").toEqual([]);
    const t0 = Date.now();
    await page.getByTestId("deal-drawer-backdrop").click();
    await expect(drawer).toBeHidden({ timeout: 100 });
    expect(Date.now() - t0).toBeLessThan(100);
    expect(rsc).toEqual([]);
    await row.click();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden({ timeout: 100 });
    expect(rsc).toEqual([]);
  });

  test("My deals only shows the logged-in user's deals", async ({ page }) => {
    await login(page, email!, password!);
    await page.goto("/deals?tab=won");
    await waitDeals(page);
    await openDeal(page, leadName);
    await page.getByTestId("deals-owner").selectOption("me");
    await waitDeals(page);
    await expect(page.locator("tr", { hasText: leadName })).toBeVisible();
    await page.getByTestId("deals-owner").selectOption("unassigned");
    await waitDeals(page);
    await expect(page.locator("tr", { hasText: leadName })).toHaveCount(0);
  });
});

test.describe("Deals org-preview", () => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL/PASSWORD");
  test.setTimeout(90_000);

  test("hides edit controls and rejects a forced write", async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
    await page.goto("/deals?tab=open");
    const switcher = page.locator("#org-preview-switcher");
    await page.waitForLoadState("networkidle");
    test.skip((await switcher.count()) === 0, "E2E_ADMIN user is not a platform admin");
    const orgId = await switcher.locator("option:not([disabled])").first().getAttribute("value");
    test.skip(!orgId, "No orgs to preview");
    await switcher.selectOption(orgId!);
    await expect(page.getByRole("button", { name: "Exit preview" })).toBeVisible({
      timeout: 20_000
    });
    await page.goto("/deals?tab=open");
    await waitDeals(page);
    await expect(page.getByTestId("deal-log-follow-up")).toHaveCount(0);
    await expect(page.getByTestId("deal-more")).toHaveCount(0);
    await page.getByTestId("deals-force-write").click();
    await expect(page.getByText(/Read-only preview/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Deals screenshots", () => {
  test.skip(!email || !password, "Set E2E_MEMBER_EMAIL/PASSWORD");
  test.setTimeout(120_000);

  test("Open view, drawer, and log-follow-up popover", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await login(page, email!, password!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/deals?tab=open");
    await waitDeals(page);
    await page.screenshot({
      path: path.join(OUT, "open-1440.png"),
      fullPage: true
    });
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.screenshot({
      path: path.join(OUT, "open-1024.png"),
      fullPage: true
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    const row = page.locator('[data-testid^="deal-row-"]').first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();
    await expect(page.getByTestId("deal-drawer")).toBeVisible();
    await page.screenshot({
      path: path.join(OUT, "drawer.png")
    });
    await page.getByTestId("deal-drawer-close").click();
    await row.hover();
    const follow = row.getByTestId("deal-log-follow-up");
    if (await follow.count()) {
      await follow.click({ force: true });
      await expect(page.getByTestId("log-follow-up-form")).toBeVisible({
        timeout: 10_000
      });
      await page.screenshot({
        path: path.join(OUT, "log-follow-up.png")
      });
    }
  });
});
