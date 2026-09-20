import { DEMO, expect, test, uniqueEmail } from "./helpers";

test("free registration: dialog, custom fields, success step, order page", async ({ page }) => {
  const email = uniqueEmail("free");
  await page.goto(`/${DEMO.org}/${DEMO.freeEvent.slug}`);
  await page.getByRole("button", { name: "Register" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: DEMO.freeEvent.name })).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill("Test Attendee");
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByLabel("What do you do?").selectOption("eng");
  await dialog.getByLabel("I agree to the code of conduct").check();
  await dialog.getByRole("button", { name: "Register" }).click();

  await expect(dialog.getByRole("heading", { name: "You're in." })).toBeVisible();
  await dialog.getByRole("link", { name: /tickets/i }).click();

  await expect(page).toHaveURL(/\/orders\//);
  await expect(page.getByRole("heading", { level: 1, name: "You're in." })).toBeVisible();
  await expect(page.getByText(DEMO.freeEvent.name).first()).toBeVisible();
});

test("the same address cannot register twice for the same event", async ({ page }) => {
  const email = uniqueEmail("dup");
  for (const attempt of [1, 2]) {
    await page.goto(`/${DEMO.org}/${DEMO.freeEvent.slug}`);
    await page.getByRole("button", { name: "Register" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill("Twice");
    await dialog.getByLabel("Email", { exact: true }).fill(email);
    await dialog.getByLabel("What do you do?").selectOption("design");
    await dialog.getByLabel("I agree to the code of conduct").check();
    await dialog.getByRole("button", { name: "Register" }).click();
    if (attempt === 1) await expect(dialog.getByRole("heading", { name: "You're in." })).toBeVisible();
    else await expect(dialog.getByRole("alert")).toBeVisible();
  }
});
