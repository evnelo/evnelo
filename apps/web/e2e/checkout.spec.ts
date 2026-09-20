import { DEMO, expect, stripeConfigured, test, uniqueEmail } from "./helpers";

/**
 * Paid checkout up to Stripe's Payment Element. Confirming a card lives inside Stripe's iframe
 * and is their contract; what is ours is the order hold, the PaymentIntent and the step change,
 * which the mounted element proves. Needs STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY (test
 * mode). CI must have them: without, this file fails rather than silently skipping.
 */
test.skip(!stripeConfigured && !process.env.CI, "Stripe test keys are not configured");

test("paid checkout: ticket choice, details, then the Payment Element mounts", async ({ page }) => {
  expect(stripeConfigured, "STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY must be set in CI").toBe(true);
  await page.goto(`/${DEMO.org}/${DEMO.paidEvent.slug}`);
  await page.getByRole("button", { name: "Register" }).click();

  const dialog = page.getByRole("dialog");
  // the radio input is visually hidden; its label card is what people tap
  await dialog.getByText("Standard", { exact: true }).click();
  await expect(dialog.getByRole("radio", { name: /Standard/ })).toBeChecked();
  await dialog.getByLabel("Name", { exact: true }).fill("Card Buyer");
  await dialog.getByLabel("Email", { exact: true }).fill(uniqueEmail("paid"));
  await dialog.getByRole("button", { name: /Continue to payment/ }).click();

  // step 2: the seats are held and Stripe's Payment Element lists the methods (Card first)
  await expect(dialog.getByText(/Tickets reserved for/)).toBeVisible();
  const element = dialog.frameLocator("iframe[name^='__privateStripeFrame']").first();
  await expect(element.getByText("Card", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("button", { name: "Pay and register" })).toBeEnabled();
});
