import { test, expect, type Page } from "@playwright/test";

/**
 * Order lifecycle E2E.
 *
 * Requires the local stack from README → "Stripe payments":
 *   npm run dev:all
 *   npm run dev:stripe
 *   STRIPE_TEST=1 E2E_TABLE_TOKEN=<demo table token> npm run test:e2e -- order-lifecycle
 *
 * Optional staff advancement (asserts the kitchen board):
 *   E2E_STAFF_EMAIL=owner@example.com E2E_STAFF_PASSWORD=... 
 *
 * Without STRIPE_TEST=1 the spec skips so core CI stays green.
 */
test.describe.configure({ mode: "serial" });

const slug = process.env.E2E_RESTAURANT_SLUG ?? "quicktab-demo-cafe";
const tableToken = process.env.E2E_TABLE_TOKEN ?? "";
const staffEmail = process.env.E2E_STAFF_EMAIL ?? "";
const staffPassword = process.env.E2E_STAFF_PASSWORD ?? "";

async function fillStripeCard(page: Page, card = "4242 4242 4242 4242") {
  const stripeFrame = page.frameLocator(
    'iframe[title="Secure payment input frame"]',
  );
  await stripeFrame.getByLabel("Card number").fill(card);
  await stripeFrame.getByLabel("Expiration date").fill("12 / 34");
  await stripeFrame.getByLabel("Security code").fill("123");
}

test("customer pays, staff advances the order, tracking reflects it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  test.skip(
    process.env.STRIPE_TEST !== "1",
    "Set STRIPE_TEST=1 with Stripe test keys + webhook relay to run the payment lifecycle.",
  );
  test.skip(!tableToken, "Set E2E_TABLE_TOKEN to a demo table token.");

  // 1) Customer places and pays for an order.
  await page.goto(`/?r=${slug}&t=${tableToken}`);
  const firstProduct = page.getByRole("button", { name: /^View / }).first();
  await expect(firstProduct).toBeVisible({ timeout: 15_000 });
  await firstProduct.click();
  await page.getByRole("button", { name: /add to order/i }).click();
  await page.getByRole("button", { name: /in your cart/i }).click();
  await page.getByRole("button", { name: /^checkout$/i }).click();

  await page.getByLabel("Name for the order").fill("E2E Guest");
  await page
    .getByLabel("Notes for the kitchen (optional)")
    .fill("Automated lifecycle test");

  const payButton = page.getByRole("button", { name: /^pay /i });
  await expect(payButton).toBeEnabled({ timeout: 20_000 });
  await fillStripeCard(page);
  await payButton.click();

  await expect(
    page.getByText(/payment received|payment confirming/i).first(),
  ).toBeVisible({ timeout: 30_000 });

  const trackLink = page.getByRole("link", { name: /track order/i });
  await expect(trackLink).toBeVisible();
  const href = await trackLink.getAttribute("href");
  expect(href).toContain("/order/");
  const orderNumber = decodeURIComponent(href!.split("/order/")[1].split("?")[0]);

  // 2) The webhook confirms the pending order; tracking leaves the pending step.
  await page.goto(href!);
  await expect(page.getByText(orderNumber).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText(/your order was sent to the kitchen/i),
  ).toBeVisible({ timeout: 30_000 });

  // 3) Staff sees the paid order on the kitchen board and advances it.
  if (!staffEmail || !staffPassword) {
    test.info().annotations.push({
      type: "note",
      description:
        "Set E2E_STAFF_EMAIL/E2E_STAFF_PASSWORD to also verify kitchen-board advancement.",
    });
    return;
  }

  await page.goto("/staff");
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByLabel("Password").fill(staffPassword);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.getByRole("button", { name: /^kitchen$/i }).first().click();

  const card = page.locator("article").filter({ hasText: orderNumber });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: /^prepare$/i }).click();
  await page.getByRole("button", { name: /yes, start preparing/i }).click();

  await page.goto(href!);
  await expect(
    page.getByText(/the kitchen is making your order/i),
  ).toBeVisible({ timeout: 30_000 });
});
