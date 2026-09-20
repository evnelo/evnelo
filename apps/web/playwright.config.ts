import { defineConfig, devices } from "@playwright/test";

/**
 * Browser smoke tests for the flows that carry the product: the public event page, free
 * registration, paid checkout up to the Payment Element, sign-in, onboarding and creating an event.
 * They run against an already running server (BASE_URL, default http://localhost:3000) whose
 * database is migrated and seeded (`pnpm db:seed`), and they need DATABASE_URL and AUTH_SECRET
 * for the same database to mint a sign-in link. CI boots the production Docker image for this.
 *
 *   pnpm --filter @evnelo/web e2e            # against the dev server
 *   pnpm --filter @evnelo/web e2e --ui       # step through in the Playwright UI
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts",
  globalSetup: "./e2e/warm-up.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // the dev server compiles routes on first hit, so locally one worker and a generous budget
  workers: process.env.CI ? 2 : 1,
  timeout: process.env.CI ? 45_000 : 120_000,
  expect: { timeout: process.env.CI ? 10_000 : 30_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // registration is a full-screen dialog on phones; one project keeps that path covered
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" }, testMatch: /registration\.spec\.ts/ },
  ],
});
