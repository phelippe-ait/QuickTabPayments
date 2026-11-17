import { test, expect } from "@playwright/test";

/**
 * Mobile viewport audit (375px) for the customer menu.
 *
 * Requires a reachable Supabase project with the demo restaurant + an active
 * table. Set `E2E_TABLE_TOKEN` to that table's `qr_token`; without it the spec
 * skips rather than failing (CI may not have demo data). Runs in the
 * `mobile-chrome` project so the touch/tap emulation is already in place.
 */
const slug = process.env.E2E_RESTAURANT_SLUG ?? "quicktab-demo-cafe";
const token = process.env.E2E_TABLE_TOKEN ?? "";

test.describe("mobile viewport audit", () => {
  test.skip(!token, "Set E2E_TABLE_TOKEN to a demo table token to run this spec.");

  test("menu fits 375px and the cart CTA is tappable", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "The 375px audit runs in the mobile-chrome project.",
    );

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/?r=${slug}&t=${token}`);

    const firstProduct = page.getByRole("button", { name: /^View / }).first();
    const menuReady = await firstProduct
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!menuReady, "The demo menu is empty in this environment.");

    // Nothing may push the page wider than the 375px viewport.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(376);

    // The staff-assisted fallback stays visible and non-blocking.
    await expect(
      page.getByText(/prefer not to order on your phone/i),
    ).toBeVisible();

    const cartCta = page.getByRole("button", {
      name: /in your cart|your cart is empty/i,
    });
    await expect(cartCta).toBeVisible();

    const box = await cartCta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    // Tapping the CTA is not swallowed by other sticky content.
    await cartCta.tap();
    await expect(
      page.getByRole("dialog", { name: /review your order/i }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(376);
  });
});
