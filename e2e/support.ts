import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared E2E helpers. The fixture lives in `supabase/e2e_seed.sql`: the
 * `e2e-bistro` restaurant, table token `e2e-table-token-fixed`, and a menu
 * whose item names all start with "E2E ".
 *
 * Every spec skips (instead of failing) when the fixture/env is absent, so a
 * PR from a fork without secrets stays green. Run the seed and set the env
 * values to turn the skips into real coverage.
 */

/** Falls back to `VITE_RESTAURANT_SLUG` so one CI variable drives both. */
export const restaurantSlug =
  process.env.E2E_RESTAURANT_SLUG?.trim() ||
  process.env.VITE_RESTAURANT_SLUG?.trim() ||
  "e2e-bistro";

/**
 * Empty by default on purpose: locally `npm run test:e2e` stays offline and
 * skips. CI passes the fixed token (see `.github/workflows/e2e.yml`).
 */
export const tableToken = process.env.E2E_TABLE_TOKEN?.trim() ?? "";

export const staffEmail = process.env.E2E_STAFF_EMAIL?.trim() ?? "";
export const staffPassword = process.env.E2E_STAFF_PASSWORD?.trim() ?? "";

/** Real card payment journey (Stripe test keys + webhook relay required). */
export const stripeTestEnabled = process.env.STRIPE_TEST === "1";

export const MISSING_FIXTURE_NOTE =
  "Seeded e2e fixture not reachable — run supabase/e2e_seed.sql and set " +
  "VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (see HUMAN_CHECKLIST §3).";

/**
 * Opens the seeded table menu. Returns `false` when the app shows an
 * environment gate (Supabase not configured, restaurant/table not seeded), so
 * callers can skip rather than fail.
 */
export async function openSeededMenu(page: Page): Promise<boolean> {
  await page.goto(`/?r=${restaurantSlug}&t=${tableToken}`);

  const seededItem = menuItemButton(page, "E2E Burger");
  const blocker = page.getByRole("alert").first();

  await expect(seededItem.or(blocker).first()).toBeVisible({ timeout: 25_000 });
  return seededItem.isVisible();
}

export function menuItemButton(page: Page, name: string): Locator {
  return page.getByRole("button", { name: `View ${name}` });
}

/**
 * Adds `E2E Fries` with the seeded single-select Size modifier ("Large", +3).
 * Also proves the P16 modifier surface renders in the real checkout flow.
 */
export async function addFriesWithLargeSize(page: Page): Promise<void> {
  await menuItemButton(page, "E2E Fries").click();

  const dialog = page.getByRole("dialog", { name: "E2E Fries" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: /Large/ }).check();
  await dialog.getByRole("button", { name: /^add to order/i }).click();
  await expect(dialog).toBeHidden();
}

/** Opens the cart drawer (the menu dock CTA) and returns it. */
export async function openCart(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: /in your cart/i }).click();
  const cart = page.getByRole("dialog", { name: /review your order/i });
  await expect(cart).toBeVisible();
  return cart;
}

/** Fills the Stripe `PaymentElement` card fields (test mode card only). */
export async function fillStripeCard(
  page: Page,
  card = "4242 4242 4242 4242",
): Promise<void> {
  const stripeFrame = page.frameLocator(
    'iframe[title="Secure payment input frame"]',
  );
  await stripeFrame.getByLabel("Card number").fill(card);
  await stripeFrame.getByLabel("Expiration date").fill("12 / 34");
  await stripeFrame.getByLabel("Security code").fill("123");
}

/** Extracts the order number from a `/order/:orderNumber?token=…` link. */
export function orderNumberFromHref(href: string): string {
  const path = href.split("/order/")[1] ?? "";
  return decodeURIComponent(path.split("?")[0]);
}
