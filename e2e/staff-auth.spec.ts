import { test, expect, type Page } from "@playwright/test";

/**
 * Staff authentication surface (A4.6).
 *
 * These checks need no credentials and no seeded data — only a configured
 * Supabase project (the sign-in form is rendered by the real auth gate). They
 * run on every PR and are not skip-guarded on secrets.
 *
 * Known gap: a *wrong-role* refusal ("No workspace access") needs a signed-in
 * account that exists in Auth but is not linked to a restaurant, which plain
 * SQL cannot seed. Covered here: the signed-out refusal and the
 * wrong-credentials path.
 */

async function openStaffGate(page: Page): Promise<boolean> {
  await page.goto("/staff");

  const emailField = page.getByLabel("Email");
  const configGate = page.getByRole("heading", {
    name: /supabase is not configured/i,
  });

  await expect(emailField.or(configGate).first()).toBeVisible({
    timeout: 25_000,
  });
  return emailField.isVisible();
}

const CONFIG_SKIP =
  "VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are not set, so the auth gate " +
  "cannot render (add the CI secrets from HUMAN_CHECKLIST §3).";

test("signed-out visitors are refused and see the staff sign-in gate", async ({
  page,
}) => {
  test.skip(!(await openStaffGate(page)), CONFIG_SKIP);

  await expect(
    page.getByRole("heading", { name: "Staff sign in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();

  // The workspace shell must not leak through the gate.
  await expect(page.getByRole("button", { name: /^kitchen$/i })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /active orders/i }),
  ).toHaveCount(0);
});

test("wrong credentials show an error and stay on the gate", async ({ page }) => {
  test.skip(!(await openStaffGate(page)), CONFIG_SKIP);

  await page.getByLabel("Email").fill("not-a-staff-member@e2e.invalid");
  await page.getByLabel("Password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: /^sign in$/i }).click();

  // The auth provider's message is surfaced verbatim in a role=alert.
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });

  // Still anonymous: gate heading remains, no kitchen board.
  await expect(
    page.getByRole("heading", { name: "Staff sign in" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^kitchen$/i })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /active orders/i }),
  ).toHaveCount(0);
});
