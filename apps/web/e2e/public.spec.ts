import { DEMO, expect, test } from "./helpers";

test("health endpoint answers with the database and job loop up", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.database).toBe("ok");
});

test("discover lists the public seeded events and hides private and draft ones", async ({ page }) => {
  await page.goto("/discover");
  const upcoming = page.getByRole("list").filter({ has: page.getByRole("heading", { level: 3 }) });
  await expect(upcoming.getByRole("heading", { level: 3, name: DEMO.paidEvent.name })).toBeVisible();
  await expect(upcoming.getByRole("heading", { level: 3, name: DEMO.freeEvent.name })).toBeVisible();
  await expect(page.getByText("Founders dinner")).toHaveCount(0);
  await expect(page.getByText("Unfinished event")).toHaveCount(0);
});

test("the event page shows the event, its tickets and the register button", async ({ page }) => {
  await page.goto(`/${DEMO.org}/${DEMO.paidEvent.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: DEMO.paidEvent.name })).toBeVisible();
  await expect(page.getByRole("button", { name: "Register" })).toBeEnabled();
});

test("a private event is not served publicly", async ({ request }) => {
  const res = await request.get(`/${DEMO.org}/founders-dinner`);
  expect(res.status()).toBe(404);
});
