import { test, expect } from "@playwright/test";
import {
  addFriesWithLargeSize,
  fillStripeCard,
  MISSING_FIXTURE_NOTE,
  openCart,
  openSeededMenu,
  orderNumberFromHref,
  stripeTestEnabled,
  tableToken,
} from "./support";

/**
 * Customer journey (A4.4): scan the seeded QR -> menu -> modifier picker ->
 * cart -> checkout -> (optional) payment -> confirmation -> tracking.
 *
 * Runs against the fixed fixture in `supabase/e2e_seed.sql`. Skips when the
 * table token/env is missing (fork PRs, offline local runs); the card payment
 * half additionally needs `STRIPE_TEST=1` plus the Stripe keys/webhook relay.
 */
const SKIP_TOKEN_NOTE =
  "Set E2E_TABLE_TOKEN (e2e-table-token-fixed after running supabase/e2e_seed.sql).";

test("scan QR -> seeded menu renders", async ({ page }) => {
  test.skip(!tableToken, SKIP_TOKEN_NOTE);
  test.skip(!(await openSeededMenu(page)), MISSING_FIXTURE_NOTE);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Known fixture items are all available and rendered.
  await expect(page.getByRole("button", { name: "View E2E Burger" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View E2E Fries" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View E2E Iced Tea" })).toBeVisible();

  // The allergen item carries its P19 warning tag.
  await expect(
    page.getByRole("button", { name: "View E2E Nut Salad" }),
  ).toContainText(/nuts/i);

  // Empty cart is announced, not just implied.
  await expect(
    page.getByRole("button", { name: /your cart is empty/i }),
  ).toBeVisible();
});

test("add seeded item with modifier -> cart -> checkout", async ({ page }) => {
  test.skip(!tableToken, SKIP_TOKEN_NOTE);
  test.skip(!(await openSeededMenu(page)), MISSING_FIXTURE_NOTE);

  await addFriesWithLargeSize(page);
  await expect(page.getByRole("button", { name: /1 item in your cart/i })).toBeVisible();

  const cart = await openCart(page);
  await expect(cart.getByText("E2E Fries")).toBeVisible();
  await expect(cart.getByText("Large")).toBeVisible();
  await expect(cart.getByText(/total/i)).toBeVisible();

  await cart.getByRole("button", { name: /^checkout$/i }).click();

  // Checkout screen loads with the order intact.
  await expect(
    page.getByRole("heading", { name: /review & place order/i }),
  ).toBeVisible();
  // Exact: the checkout footer also mentions the table.
  await expect(page.getByText("Table 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /order summary/i }),
  ).toBeVisible();
  await expect(page.getByText(/E2E Fries/)).toBeVisible();
  await expect(page.getByText("Large")).toBeVisible();

  if (!stripeTestEnabled) {
    test
      .info()
      .annotations.push({
        type: "note",
        description:
          "Set STRIPE_TEST=1 (with Stripe test keys, /api on :3001 and the webhook relay) to also verify payment, confirmation and tracking.",
      });
    return;
  }

  // Full payment path (CI only when the secret is present).
  await page.getByLabel("Name for the order").fill("E2E Guest");
  await page
    .getByLabel("Notes for the kitchen (optional)")
    .fill("Automated customer journey");

  const payButton = page.getByRole("button", { name: /^pay /i });
  await expect(payButton).toBeEnabled({ timeout: 20_000 });
  await fillStripeCard(page);
  await payButton.click();

  // Confirmation screen (webhook may still be confirming the payment).
  await expect(
    page.getByText(/payment received|payment confirming/i).first(),
  ).toBeVisible({ timeout: 30_000 });

  const trackLink = page.getByRole("link", { name: /track order/i });
  await expect(trackLink).toBeVisible();
  const href = await trackLink.getAttribute("href");
  expect(href).toContain("/order/");
  const orderNumber = orderNumberFromHref(href!);

  // Tracking page: order details, then the webhook moves it to `confirmed`.
  await page.goto(href!);
  await expect(page.getByText(orderNumber).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/E2E Fries/)).toBeVisible();
  await expect(page.getByText("Large")).toBeVisible();
  await expect(page.getByText(/your order was sent to the kitchen/i)).toBeVisible(
    { timeout: 45_000 },
  );
});
