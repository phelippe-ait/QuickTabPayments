import { test, expect } from "@playwright/test";
import {
  addFriesWithLargeSize,
  fillStripeCard,
  MISSING_FIXTURE_NOTE,
  openCart,
  openSeededMenu,
  orderNumberFromHref,
  staffEmail,
  staffPassword,
  stripeTestEnabled,
  tableToken,
} from "./support";

/**
 * Order lifecycle E2E (A4.5): customer pays -> webhook confirms -> staff
 * advances one step -> customer tracking reflects it.
 *
 * Requires the local stack from README → "Stripe payments":
 *   npm run dev:all
 *   npm run dev:stripe
 *   STRIPE_TEST=1 E2E_TABLE_TOKEN=e2e-table-token-fixed npm run test:e2e -- order-lifecycle
 *
 * Optional staff advancement (asserts the kitchen board):
 *   E2E_STAFF_EMAIL=e2e-staff@quicktab.demo E2E_STAFF_PASSWORD=...
 * (that account must exist in Supabase Auth and be linked by e2e_seed.sql).
 *
 * Without STRIPE_TEST=1 the spec skips so core CI stays green: the checkout
 * surface is Stripe-only, so there is no simulated payment path to drive.
 */
test.describe.configure({ mode: "serial" });

test("customer pays, staff advances the order, tracking reflects it", async ({
  page,
}) => {
  test.setTimeout(180_000);
  test.skip(
    !stripeTestEnabled,
    "Set STRIPE_TEST=1 with Stripe test keys + webhook relay to run the payment lifecycle.",
  );
  test.skip(
    !tableToken,
    "Set E2E_TABLE_TOKEN (e2e-table-token-fixed after running supabase/e2e_seed.sql).",
  );
  test.skip(!(await openSeededMenu(page)), MISSING_FIXTURE_NOTE);

  // 1) Customer places and pays for a seeded order (with a modifier).
  await addFriesWithLargeSize(page);
  const cart = await openCart(page);
  await cart.getByRole("button", { name: /^checkout$/i }).click();

  await expect(
    page.getByRole("heading", { name: /review & place order/i }),
  ).toBeVisible();
  await page.getByLabel("Name for the order").fill("E2E Lifecycle Guest");
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
  const orderNumber = orderNumberFromHref(href!);

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
        "Set E2E_STAFF_EMAIL/E2E_STAFF_PASSWORD (and link that account via e2e_seed.sql) to also verify kitchen-board advancement.",
    });
    return;
  }

  await page.goto("/staff");
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByLabel("Password").fill(staffPassword);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.getByRole("button", { name: /^kitchen$/i }).first().click();

  const card = page.locator("article").filter({ hasText: orderNumber }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: /^prepare$/i }).click();
  await page.getByRole("button", { name: /yes, start preparing/i }).click();

  // 4) Tracking picks the change up (realtime for staff sessions, polling for
  // guests — poll the DOM so either path is accepted, never a fixed sleep).
  await page.goto(href!);
  await expect
    .poll(
      async () => page.getByText(/the kitchen is making your order/i).count(),
      { timeout: 45_000, intervals: [500, 1_000, 2_000, 5_000] },
    )
    .toBeGreaterThan(0);

  // Exactly one step was advanced: still preparing, not ready.
  await expect(
    page.getByText(/ready to collect from the counter/i),
  ).toHaveCount(0);
});
