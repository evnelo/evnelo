import { DEMO, expect, signIn, test, uniqueEmail } from "./helpers";

/**
 * The platform admin pages. The server under test must list this address in ADMIN_EMAILS
 * (CI boots the image with it; locally start the server with ADMIN_EMAILS set).
 */
const ADMIN = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.evnelo.test";

test("signed out, /admin asks for sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
});

test("a host who is not a platform admin gets a 404", async ({ page }) => {
  await signIn(page, uniqueEmail("not-admin"), "/admin");
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
});

test("a platform admin sees every organization and drills into one", async ({ page }) => {
  await signIn(page, ADMIN, "/admin");
  await expect(page.getByRole("heading", { name: "Organizations", level: 1 })).toBeVisible();

  await page.getByRole("searchbox").fill(DEMO.org);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\?q=demo/);
  const row = page.getByRole("row").filter({ hasText: `/${DEMO.org}` });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("link", { name: /Open the public page of/ })).toHaveAttribute("href", `/o/${DEMO.org}`);

  await row.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/admin\/organizations\/[0-9A-Z]{26}$/);
  const event = page.getByRole("row").filter({ hasText: DEMO.freeEvent.name });
  await expect(event).toBeVisible();
  await expect(event.getByRole("link")).toHaveAttribute("href", `/${DEMO.org}/${DEMO.freeEvent.slug}`);
  await expect(page.getByRole("row").filter({ hasText: DEMO.paidEvent.name })).toBeVisible();
});
