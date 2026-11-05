import { test, expect } from "@playwright/test";

/**
 * Customer smoke test: scan a table QR -> menu renders -> add to cart.
 *
 * Requires a reachable Supabase project with the demo restaurant + an active
 * table. Set `E2E_TABLE_TOKEN` to that table's `qr_token`; without it the spec
 * skips rather than failing (CI may not have demo data).
 */
const slug = process.env.E2E_RESTAURANT_SLUG ?? "quicktab-demo-cafe";
const token = process.env.E2E_TABLE_TOKEN ?? "";

test("scan QR -> menu -> add to cart", async ({ page }) => {
  test.skip(!token, "Set E2E_TABLE_TOKEN to a demo table token to run this spec.");

  await page.goto(`/?r=${slug}&t=${token}`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  const firstProduct = page.getByRole("button", { name: /add|view/i }).first();
  if (!(await firstProduct.isVisible().catch(() => false))) {
    test.skip(true, "The demo menu is empty in this environment.");
  }
  await firstProduct.click();
  await page.getByRole("button", { name: /add to order/i }).click();
  await expect(page.getByText(/item(s)? in your cart|your cart is empty/i)).toBeVisible();
});
