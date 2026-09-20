import { expect, signIn, test, uniqueEmail } from "./helpers";

test("sign in, create an organization, create and publish an event, see it live", async ({ page }) => {
  const email = uniqueEmail("host");
  const stamp = Date.now().toString(36);
  await signIn(page, email);

  // first sign-in lands on onboarding: every event belongs to an organization
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel(/organization name|^name$/i).fill(`E2E Org ${stamp}`);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/events/new");
  await expect(page.getByRole("heading", { name: "New event" })).toBeVisible();
  await page.locator("#name").fill(`E2E Event ${stamp}`);
  await page.locator("#starts").fill("2031-06-01T18:00");
  await page.locator("#ends").fill("2031-06-01T21:00");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/dashboard\/events\/[0-9A-Z]{26}$/);
  await expect(page.getByText(`E2E Event ${stamp}`).first()).toBeVisible();

  await page.getByRole("button", { name: "Publish event" }).click();
  await expect(page.getByRole("button", { name: /Unpublish/ })).toBeVisible();

  // the overview links the public page by its full URL; APP_URL may differ from BASE_URL locally, so keep the path
  const href = await page.getByRole("link", { name: /\/e2e-org-[a-z0-9]+\/e2e-event-[a-z0-9]+$/ }).first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(new URL(href!, process.env.BASE_URL ?? "http://localhost:3000").pathname);
  await expect(page.getByRole("heading", { level: 1, name: `E2E Event ${stamp}` })).toBeVisible();
});
