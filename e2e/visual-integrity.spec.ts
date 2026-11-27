import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

const email = process.env.E2E_MEMBER_EMAIL || process.env.TEST_MEMBER_EMAIL;
const password = process.env.E2E_MEMBER_PASSWORD || process.env.TEST_MEMBER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD;

test.use({
  contextOptions: { reducedMotion: "no-preference" }
});

test.beforeEach(({}, info) => {
  test.skip(
    info.project.name === "chromium-reduced-motion",
    "visual-integrity must run with motion enabled"
  );
});

const MEMBER_PAGES: Array<{ id: string; path: string }> = [
  { id: "home", path: "/" },
  { id: "leads-table", path: "/leads?dead=hide" },
  { id: "wq-cards-all", path: "/leads/queue?view=cards&tab=all" },
  { id: "wq-cards-meetings", path: "/leads/queue?view=cards&tab=meetings_booked" },
  { id: "wq-cards-follow-ups", path: "/leads/queue?view=cards&tab=follow_ups_due" },
  { id: "wq-table-all", path: "/leads/queue?view=table&tab=all" },
  { id: "deals-open", path: "/deals?tab=open" },
  { id: "deals-won", path: "/deals?tab=won" },
  { id: "deals-lost", path: "/deals?tab=lost" },
  { id: "insights", path: "/insights" },
  { id: "meta-ads", path: "/meta-ads" },
  { id: "website", path: "/website" }
];

const ADMIN_PAGES: Array<{ id: string; path: string }> = [
  { id: "clients-ads", path: "/clients-ads" },
  { id: "organizations", path: "/admin/organizations" }
];

type ScanIssue = {
  selector: string;
  text: string;
  opacity?: number;
  visibility?: string;
  size?: string;
  ratio?: number;
  fg?: string;
  bg?: string;
};

type ScanResult = {
  opacityFails: ScanIssue[];
  contrastFails: ScanIssue[];
};

async function login(page: Page, user: string, pass: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user);
  await page.getByLabel("Password").fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
}

const POPOVER_SHOTS = path.join("e2e", "screenshots", "popovers");

function failIfPinnedToOrigin(
  trigger: { x: number; y: number },
  pop: { x: number; y: number }
) {
  if (trigger.x > 8 || trigger.y > 8) {
    expect(
      pop.x <= 4 && pop.y <= 4,
      "popover top-left is at viewport (0,0) while the trigger is elsewhere"
    ).toBe(false);
  }
}

async function assertAnchoredToTrigger(
  page: Page,
  trigger: import("@playwright/test").Locator,
  opts?: { saveName?: string | RegExp; shot?: string; theme?: string }
) {
  const pop = page.locator("[data-action-popover]").last();
  await expect(pop).toBeVisible();
  await page.waitForTimeout(200);
  const t = await trigger.boundingBox();
  const p = await pop.boundingBox();
  expect(t, "trigger bounding box").toBeTruthy();
  expect(p, "popover bounding box").toBeTruthy();
  failIfPinnedToOrigin(t!, p!);

  const vp = page.viewportSize()!;
  expect(p!.x).toBeGreaterThanOrEqual(-1);
  expect(p!.y).toBeGreaterThanOrEqual(-1);
  expect(p!.x + p!.width).toBeLessThanOrEqual(vp.width + 1);
  expect(p!.y + p!.height).toBeLessThanOrEqual(vp.height + 1);

  const gapX =
    p!.x > t!.x + t!.width
      ? p!.x - (t!.x + t!.width)
      : t!.x > p!.x + p!.width
        ? t!.x - (p!.x + p!.width)
        : 0;
  expect(
    gapX <= 24,
    `popover x=${p!.x.toFixed(1)} w=${p!.width.toFixed(1)} not within 24px of trigger x=${t!.x.toFixed(1)} w=${t!.width.toFixed(1)} (gap=${gapX.toFixed(1)})`
  ).toBe(true);

  const gapY =
    p!.y > t!.y + t!.height
      ? p!.y - (t!.y + t!.height)
      : t!.y > p!.y + p!.height
        ? t!.y - (p!.y + p!.height)
        : 0;
  expect(
    gapY <= 24,
    `popover y=${p!.y.toFixed(1)} h=${p!.height.toFixed(1)} not within 24px of trigger y=${t!.y.toFixed(1)} h=${t!.height} (gap=${gapY.toFixed(1)})`
  ).toBe(true);

  if (opts?.saveName) {
    const save = pop.getByRole("button", { name: opts.saveName });
    await expect(save).toBeVisible();
    await expect(save).toBeEnabled();
  }

  if (opts?.shot && opts.theme) {
    mkdirSync(POPOVER_SHOTS, { recursive: true });
    await pop.screenshot({
      path: path.join(POPOVER_SHOTS, `${opts.shot}-${opts.theme}.png`)
    });
  }
}

async function screenshotBaseline(page: Page, id: string, theme: string) {
  await expect(page).toHaveScreenshot(`${id}-${theme}.png`, {
    animations: "allow",
    caret: "hide",
    maxDiffPixelRatio: 0.03
  });
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");
}

async function firstLeadNameFromSsr(page: Page): Promise<string | null> {
  const res = await page.request.get("/leads?dead=hide");
  const html = await res.text();
  const m = html.match(
    /<button type="button" class="text-left hover:underline">([^<]*)<\/button>/
  );
  return m ? decodeHtml(m[1]).trim() : null;
}

async function scan(page: Page): Promise<ScanResult> {
  return page.evaluate(() => {
    function parseColor(c: string) {
      const m = c.match(
        /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/
      );
      if (!m) return null;
      return {
        r: Number(m[1]),
        g: Number(m[2]),
        b: Number(m[3]),
        a: m[4] === undefined ? 1 : Number(m[4])
      };
    }

    function relLum(c: { r: number; g: number; b: number }) {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }

    function contrast(
      fg: { r: number; g: number; b: number },
      bg: { r: number; g: number; b: number }
    ) {
      const L1 = relLum(fg);
      const L2 = relLum(bg);
      const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
      return (hi + 0.05) / (lo + 0.05);
    }

    function mix(
      top: { r: number; g: number; b: number; a: number },
      bot: { r: number; g: number; b: number }
    ) {
      const a = top.a;
      return {
        r: top.r * a + bot.r * (1 - a),
        g: top.g * a + bot.g * (1 - a),
        b: top.b * a + bot.b * (1 - a)
      };
    }

    function cssPath(el: Element) {
      const parts: string[] = [];
      let node: Element | null = el;
      while (node && node.nodeType === 1 && parts.length < 6) {
        let s = node.tagName.toLowerCase();
        const testId = node.getAttribute("data-testid");
        if (node.id) {
          parts.unshift(`#${node.id}`);
          break;
        }
        if (testId) s += `[data-testid="${testId}"]`;
        const parent: Element | null = node.parentElement;
        if (parent) {
          const current = node;
          const same = [...parent.children].filter(
            (c) => c.tagName === current.tagName
          );
          if (same.length > 1) s += `:nth-of-type(${same.indexOf(current) + 1})`;
        }
        parts.unshift(s);
        node = parent;
      }
      return parts.join(" > ");
    }

    function effectiveOpacity(el: Element) {
      let n = 1;
      let node: Element | null = el;
      while (node && node !== document.documentElement) {
        const op = Number(getComputedStyle(node).opacity);
        if (!Number.isNaN(op)) n *= op;
        node = node.parentElement;
      }
      return n;
    }

    function effectiveBg(el: Element) {
      let node: Element | null = el;
      let acc: { r: number; g: number; b: number } | null = null;
      while (node) {
        const bg = parseColor(getComputedStyle(node).backgroundColor);
        if (bg && bg.a > 0) {
          acc = acc ? mix({ ...bg }, acc) : { r: bg.r, g: bg.g, b: bg.b };
          if (bg.a >= 0.99) break;
        }
        node = node.parentElement;
      }
      return acc;
    }

    function skipNode(el: Element) {
      if (el.closest("nextjs-portal, script, style, noscript, svg, option, optgroup")) {
        return true;
      }
      if (el.closest(".sr-only, [hidden], [aria-hidden='true']")) return true;
      if (el.closest(":disabled, [aria-disabled='true']")) return true;
      let n: Element | null = el;
      while (n) {
        const cls = typeof n.className === "string" ? n.className : "";
        if (
          cls.includes("group-hover:opacity-100") ||
          cls.includes("group-focus-within:opacity-100")
        ) {
          return true;
        }
        n = n.parentElement;
      }
      return false;
    }

    const roots = [
      ...document.querySelectorAll(
        "main, [role='dialog'], [data-action-popover], [data-testid='cf-popover'], [data-testid='toast-stack']"
      )
    ];
    const opacityFails: ScanIssue[] = [];
    const contrastFails: ScanIssue[] = [];
    const seen = new Set<Element>();

    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = (node.textContent || "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const el = node.parentElement;
        if (!el || seen.has(el) || skipNode(el)) continue;
        seen.add(el);
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const op = effectiveOpacity(el);
        const vis = cs.visibility;
        const sizeOk = rect.width >= 1 && rect.height >= 1;
        const selector = cssPath(el);
        // Native <option> and overflow-collapsed chrome can be 0×N with
        // opacity 1; those are not the "content stuck at opacity 0" bug.
        if (!sizeOk && op >= 0.9 && vis !== "hidden") continue;
        if (op < 0.9 || vis === "hidden" || !sizeOk) {
          opacityFails.push({
            selector,
            text: text.slice(0, 80),
            opacity: op,
            visibility: vis,
            size: `${Math.round(rect.width)}x${Math.round(rect.height)}`
          });
          continue;
        }
        const fg = parseColor(cs.color);
        const bg = effectiveBg(el);
        if (!fg || !bg) continue;
        const composed =
          fg.a < 0.99 ? mix(fg, bg) : { r: fg.r, g: fg.g, b: fg.b };
        const ratio = contrast(composed, bg);
        const fontSize = Number.parseFloat(cs.fontSize);
        const weight = Number.parseInt(cs.fontWeight, 10) || 400;
        const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
        const min = large ? 3 : 4.5;
        if (ratio < min - 0.01) {
          contrastFails.push({
            selector,
            text: text.slice(0, 80),
            ratio: Number(ratio.toFixed(2)),
            fg: cs.color,
            bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`
          });
        }
      }
    }
    return { opacityFails, contrastFails };
  });
}

async function assertVisualIntegrity(page: Page, label: string) {
  const result = await scan(page);
  expect(
    result.opacityFails,
    `${label} invisible text: ${JSON.stringify(result.opacityFails, null, 2)}`
  ).toEqual([]);
  expect(
    result.contrastFails,
    `${label} contrast: ${JSON.stringify(result.contrastFails, null, 2)}`
  ).toEqual([]);

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2aa"])
    .exclude("nextjs-portal")
    .analyze();
  const contrast = axe.violations.filter((v) => v.id === "color-contrast");
  expect(
    contrast,
    `${label} axe color-contrast: ${JSON.stringify(contrast, null, 2)}`
  ).toEqual([]);
}

test.describe.configure({ mode: "serial" });

test.describe("visual integrity (motion on)", () => {
  test.skip(!email || !password, "needs E2E/TEST member creds");
  test.setTimeout(360_000);

  test("every member page in both themes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, email!, password!);

    for (const theme of ["light", "dark"] as const) {
      await page.goto("/");
      await setTheme(page, theme);

      for (const route of MEMBER_PAGES) {
        await page.goto(route.path);
        await settle(page);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await assertVisualIntegrity(page, `${route.id} ${theme}`);
        await screenshotBaseline(page, route.id, theme);
        if (route.id === "leads-table") {
          const out = path.join("e2e", "screenshots", "visual-integrity");
          mkdirSync(out, { recursive: true });
          await page.screenshot({
            path: path.join(out, `leads-${theme}.png`)
          });
        }
      }
    }

    await page.goto("/leads?dead=hide");
    await settle(page);
    const headerCells = page.locator("main table thead th");
    await expect(headerCells.first()).toBeVisible();
    const headerOpacity = await headerCells.first().evaluate((el) => {
      let n = 1;
      let node: Element | null = el;
      while (node) {
        n *= Number(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      return n;
    });
    expect(headerOpacity).toBeGreaterThanOrEqual(0.9);

    const rows = page.locator("main table tbody tr");
    await expect(rows).toHaveCount(await rows.count());
    expect(await rows.count()).toBeGreaterThanOrEqual(10);
    for (let i = 0; i < 10; i++) {
      const op = await rows.nth(i).evaluate((el) => {
        let n = 1;
        let node: Element | null = el;
        while (node) {
          n *= Number(getComputedStyle(node).opacity);
          node = node.parentElement;
        }
        return n;
      });
      expect(op, `leads row ${i} opacity`).toBeGreaterThanOrEqual(0.9);
    }

    const apiName = await firstLeadNameFromSsr(page);
    expect(apiName, "SSR first lead name").toBeTruthy();
    const uiName = (
      await page.locator("main table tbody tr td button").first().innerText()
    ).trim();
    expect(uiName).toBe(apiName);
  });

  test("drawers, filter, views, toast in both themes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, email!, password!);

    for (const theme of ["light", "dark"] as const) {
      await page.goto("/");
      await setTheme(page, theme);

      await page.goto("/leads?dead=hide");
      await settle(page);
      await page.locator("main table tbody tr td button").first().click();
      const leadDrawer = page.getByTestId("lead-drawer");
      await expect(leadDrawer).toBeVisible();
      await expect(leadDrawer.locator(".skeleton-shimmer")).toHaveCount(0, {
        timeout: 20_000
      });
      await settle(page);
      await assertVisualIntegrity(page, `lead-drawer ${theme}`);
      await screenshotBaseline(page, "lead-drawer", theme);
      await page.getByTestId("lead-drawer-close").click();

      await page.goto("/deals?tab=open");
      await settle(page);
      const dealRow = page.locator("[data-testid^='deal-row-']").first();
      if (await dealRow.count()) {
        await dealRow.click();
        const dealDrawer = page.getByTestId("deal-drawer");
        await expect(dealDrawer).toBeVisible({ timeout: 10_000 });
        await settle(page);
        await assertVisualIntegrity(page, `deal-drawer ${theme}`);
        await screenshotBaseline(page, "deal-drawer", theme);
        await page.keyboard.press("Escape");
      }

      await page.goto("/leads/queue?view=table");
      await settle(page);
      await page.getByTestId("cf-filter").click();
      await expect(page.getByTestId("cf-popover")).toBeVisible();
      await settle(page);
      await assertVisualIntegrity(page, `filter-popover ${theme}`);
      await screenshotBaseline(page, "filter-popover", theme);
      await page.keyboard.press("Escape");

      await page.getByTestId("cf-saved").click();
      await expect(page.getByTestId("cf-saved-menu")).toBeVisible({
        timeout: 5_000
      });
      await settle(page);
      await assertVisualIntegrity(page, `views-menu ${theme}`);
      await screenshotBaseline(page, "views-menu", theme);
      await page.keyboard.press("Escape");

      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: () => Promise.reject(new Error("denied")) }
        });
      });
      const copyBtn = page.getByTestId("copy-phone").first();
      if ((await copyBtn.count()) === 0) {
        await page.getByRole("button", { name: "Columns" }).click();
        const phone = page.locator("#col-phone");
        if (await phone.count()) {
          if (!(await phone.isChecked())) await phone.check();
        }
        await page.keyboard.press("Escape");
      }
      const copy = page.getByTestId("copy-phone").first();
      if (await copy.count()) {
        await copy.scrollIntoViewIfNeeded();
        await copy.click({ force: true });
        await expect(page.getByTestId("toast-error")).toBeVisible();
        await settle(page);
        await assertVisualIntegrity(page, `toast ${theme}`);
        await screenshotBaseline(page, "toast", theme);
      }
    }
  });
});

test.describe("visual integrity admin", () => {
  test.skip(!adminEmail || !adminPassword, "needs admin creds");
  test.setTimeout(180_000);

  test("client ads and organizations in both themes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, adminEmail!, adminPassword!);
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/");
      await setTheme(page, theme);
      for (const route of ADMIN_PAGES) {
        await page.goto(route.path);
        if (!page.url().includes(route.path.split("?")[0])) continue;
        await settle(page);
        await assertVisualIntegrity(page, `${route.id} ${theme}`);
        await screenshotBaseline(page, route.id, theme);
      }
    }
  });
});

test.describe("visual integrity login", () => {
  test.setTimeout(60_000);

  test("login page both themes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const origin = test.info().project.use.baseURL ?? "http://127.0.0.1:3000";
    for (const theme of ["light", "dark"] as const) {
      await page.context().addCookies([{ name: "theme", value: theme, url: origin }]);
      await page.goto("/login");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await settle(page);
      await assertVisualIntegrity(page, `login ${theme}`);
      await screenshotBaseline(page, "login", theme);
    }
  });
});

test.describe("popover anchoring (motion on)", () => {
  test.skip(!email || !password, "needs E2E/TEST member creds");
  test.setTimeout(180_000);

  test("Log Call, Stage Actions, Cancel booking, Deals, Filter, Views", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, email!, password!);

    for (const theme of ["light", "dark"] as const) {
      await page.goto("/");
      await setTheme(page, theme);

      await page.goto("/leads/queue?view=cards&tab=all");
      await page.waitForLoadState("networkidle");
      const firstLog = page.getByRole("button", { name: "Log Call" }).first();
      await expect(firstLog).toBeVisible({ timeout: 20_000 });
      await firstLog.click();
      await assertAnchoredToTrigger(page, firstLog, {
        saveName: "Save",
        shot: "wq-card-log-call",
        theme
      });
      await page.keyboard.press("Escape");

      const logs = page.getByRole("button", { name: "Log Call" });
      const lastLog = logs.nth(Math.max(0, (await logs.count()) - 1));
      await lastLog.scrollIntoViewIfNeeded();
      await lastLog.click();
      await assertAnchoredToTrigger(page, lastLog, {
        saveName: "Save",
        shot: "wq-card-log-call-bottom",
        theme
      });
      await page.keyboard.press("Escape");

      await page.goto("/leads/queue?view=table&tab=all");
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("work-queue-row").first()).toBeVisible({
        timeout: 20_000
      });
      const columnsBtn = page.getByRole("button", { name: "Columns" });
      if (await columnsBtn.count()) {
        await columnsBtn.click();
        const stageCol = page.locator("#col-stage");
        if ((await stageCol.count()) && !(await stageCol.isChecked())) {
          await stageCol.check();
        }
        const schedCol = page.locator("#col-call_scheduled_for");
        if ((await schedCol.count()) && !(await schedCol.isChecked())) {
          await schedCol.check();
        }
        await page.keyboard.press("Escape");
      }
      const actions = page.getByRole("button", { name: "Actions" }).first();
      await actions.scrollIntoViewIfNeeded();
      await expect(actions).toBeVisible({ timeout: 20_000 });
      await actions.click();
      await assertAnchoredToTrigger(page, actions, {
        shot: "wq-table-stage-actions",
        theme
      });
      await page.keyboard.press("Escape");

      await page.goto("/leads/queue?view=table&tab=meetings_booked");
      await page.waitForLoadState("networkidle");
      const cancel = page.getByTestId("cancel-booking-button").first();
      if (await cancel.count()) {
        await cancel.scrollIntoViewIfNeeded();
        await cancel.click();
        await assertAnchoredToTrigger(page, cancel, {
          saveName: "Cancel booking",
          shot: "wq-table-cancel-booking",
          theme
        });
        await page.keyboard.press("Escape");
      }

      await page.goto("/deals?tab=open");
      await page.waitForLoadState("networkidle");
      const follow = page.getByTestId("deal-log-follow-up").first();
      if (await follow.count()) {
        await follow.scrollIntoViewIfNeeded();
        await follow.click();
        await assertAnchoredToTrigger(page, follow, {
          shot: "deals-log-follow-up",
          theme
        });
        await page.keyboard.press("Escape");
      }

      await page.goto("/leads/queue?view=table&tab=all");
      await page.waitForLoadState("networkidle");
      const filterBtn = page.getByTestId("cf-filter");
      await filterBtn.click();
      await assertAnchoredToTrigger(page, filterBtn, {
        shot: "filter-popover",
        theme
      });
      await page.keyboard.press("Escape");

      const viewsBtn = page.getByTestId("cf-saved");
      await viewsBtn.click();
      await assertAnchoredToTrigger(page, viewsBtn, {
        shot: "views-menu",
        theme
      });
      await page.keyboard.press("Escape");

      const collapse = page.getByRole("button", { name: "Collapse sidebar" });
      if (await collapse.isVisible()) await collapse.click();
      await page.goto("/leads/queue?view=cards&tab=all");
      await page.waitForLoadState("networkidle");
      const logCollapsed = page.getByRole("button", { name: "Log Call" }).first();
      await expect(logCollapsed).toBeVisible({ timeout: 20_000 });
      await logCollapsed.click();
      await assertAnchoredToTrigger(page, logCollapsed, {
        saveName: "Save",
        shot: "wq-card-log-call-collapsed",
        theme
      });
      await page.keyboard.press("Escape");
      const expand = page.getByRole("button", { name: "Expand sidebar" });
      if (await expand.isVisible()) await expand.click();
    }
  });
});
