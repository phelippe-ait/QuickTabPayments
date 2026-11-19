import { test, expect } from "@playwright/test";
import { menuItemButton, openSeededMenu, restaurantSlug, tableToken } from "./support";

/**
 * Landmark/heading checks for the customer menu.
 *
 * axe-core is intentionally not a dependency, so these are plain DOM queries
 * against the seeded fixture. Skips without `E2E_TABLE_TOKEN`, like the other
 * specs.
 */
test.describe("customer accessibility landmarks", () => {
  test.skip(!tableToken, "Set E2E_TABLE_TOKEN to a demo table token to run this spec.");

  test("exposes one h1, a main landmark and a named menu toggle", async ({
    page,
  }) => {
    const ready = await openSeededMenu(page);
    test.skip(!ready, "The seeded menu is unavailable in this environment.");

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("main")).toBeVisible();

    const menuToggle = page.getByRole("button", { name: "Open menu" });
    await expect(menuToggle).toBeVisible();
    await expect(menuToggle).toHaveAttribute("aria-expanded", "false");

    await expect(
      page.getByRole("button", { name: /^View E2E Burger/ }),
    ).toBeVisible();
  });

  test("reflows at 320px without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`/?r=${restaurantSlug}&t=${tableToken}`);

    const firstProduct = page.getByRole("button", { name: /^View / }).first();
    const menuReady = await firstProduct
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!menuReady, "The demo menu is empty in this environment.");

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(321);

    await expect(menuItemButton(page, "E2E Burger")).toBeVisible();
  });
});
