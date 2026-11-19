import { test, expect } from "@playwright/test"
import { staffEmail, staffPassword } from "./support"

/**
 * Admin responsive audit (P32).
 *
 * Runs the mobile-chrome (375px) project only. It needs a real staff account;
 * without `E2E_STAFF_EMAIL` / `E2E_STAFF_PASSWORD` (or a reachable Supabase
 * project) it skips instead of failing.
 */
async function signInToAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin")

  const email = page.getByLabel("Email")
  const catalogHeading = page.getByRole("heading", { name: /^catalog$/i })
  await expect(email.or(catalogHeading)).toBeVisible({ timeout: 25_000 })

  if (!(await email.isVisible())) return true

  await email.fill(staffEmail)
  await page.getByLabel("Password").fill(staffPassword)
  await page.getByRole("button", { name: /^sign in$/i }).click()

  const signedIn = await catalogHeading
    .waitFor({ state: "visible", timeout: 25_000 })
    .then(() => true)
    .catch(() => false)
  return signedIn
}

test.describe("admin responsive audit", () => {
  test("375px admin routes do not scroll horizontally", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "The 375px audit runs in the mobile-chrome project.",
    )
    test.skip(
      !staffEmail || !staffPassword,
      "Set E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD to run the signed-in admin audit.",
    )

    await page.setViewportSize({ width: 375, height: 667 })
    const signedIn = await signInToAdmin(page)

    test.skip(
      !signedIn,
      "The demo restaurant/account is not reachable in this environment.",
    )

    const menuButton = page.getByRole("button", { name: "Open navigation" })
    await expect(menuButton).toBeVisible()
    const menuBox = await menuButton.boundingBox()
    expect(menuBox?.width).toBeGreaterThanOrEqual(44)
    expect(menuBox?.height).toBeGreaterThanOrEqual(44)

    await menuButton.click()
    await expect(
      page.getByRole("link", { name: /catalog/i }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
    const closedMenuButton = page.getByRole("button", {
      name: "Open navigation",
    })
    await expect(closedMenuButton).toHaveAttribute("aria-expanded", "false")
    await expect(closedMenuButton).toBeFocused()

    for (const route of ["/admin/orders", "/admin/reports"]) {
      await page.goto(route)
      await expect(page.locator("main")).toBeVisible()

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(
        overflow.scrollWidth,
        `${route} must not scroll horizontally at 375px`,
      ).toBeLessThanOrEqual(overflow.innerWidth + 1)
    }
  })
})
