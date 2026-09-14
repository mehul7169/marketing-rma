import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E only. Set E2E_BASE_URL to hit staging; default is local next dev.
 *
 * Required for auth flows (leave unset to skip those tests):
 *   E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 *   E2E_NO_ORG_EMAIL / E2E_NO_ORG_PASSWORD  (user with zero memberships)
 *   E2E_INVITED_EMAIL / E2E_INVITED_PASSWORD (pending invite, for signup)
 *
 * Do NOT point these at production RMA data.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
