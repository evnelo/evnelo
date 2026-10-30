import { expect, test } from "./helpers";

test("pricing: the calculator follows checkout's fee math", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "0.99% on paid tickets. Nothing on free ones." })).toBeVisible();
  await page.getByLabel("Ticket price").fill("40");
  await page.getByLabel("Tickets sold").fill("100");
  // 0.99% of $40 rounds to 40 cents: the host receives $39.60 a ticket
  await expect(page.locator("dd").filter({ hasText: "$3,960.00" })).toBeVisible();
  await page.getByRole("button", { name: "The buyer does" }).click();
  await expect(page.locator("dd").filter({ hasText: "$40.40" })).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: "$4,000.00" })).toBeVisible();
});

test("compare: Eventbrite's per-ticket fee on the visitor's own price, with its source", async ({ page }) => {
  await page.goto("/compare/eventbrite");
  await expect(page.getByRole("heading", { level: 1, name: "An Eventbrite alternative that charges 0.99%" })).toBeVisible();
  await page.getByLabel("Ticket price").fill("10");
  // Eventbrite: 3.7% of $10 + $1.79 = $2.16 a ticket; Evnelo: 10 cents
  await expect(page.getByText("$2.16 per ticket")).toBeVisible();
  await expect(page.getByText("With Evnelo you keep")).toContainText("$412.00");
  await expect(page.getByRole("link", { name: "www.eventbrite.com/organizer/pricing/" })).toBeVisible();
});

test("compare: only the listed competitors have a page", async ({ request }) => {
  expect((await request.get("/compare/luma")).status()).toBe(200);
  expect((await request.get("/compare/sympla")).status()).toBe(404);
});

test("brasil: Portuguese and reais whatever the browser's language", async ({ page }) => {
  await page.goto("/brasil");
  await expect(page.locator('[lang="pt-BR"]').getByRole("heading", { level: 1, name: "Venda ingressos com Pix e pague 0,99%." })).toBeVisible();
  await expect(page.getByLabel("Preço do ingresso")).toHaveValue("50");
  await expect(page.getByText("R$ 0,50 por ingresso")).toBeVisible();
});
