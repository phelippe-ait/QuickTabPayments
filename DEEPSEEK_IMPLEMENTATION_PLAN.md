# QuickTab — DeepSeek Implementation Plan (Critical Path)

**Audience:** DeepSeek 4.1 Flash (implementation model). This is a build plan, not a
project-management plan. Every ticket lists exact files, concrete steps, code sketches,
tests, and acceptance criteria. Implement tickets **in dependency order**, one PR-sized
ticket at a time.

**Source of truth for current code state:** this repository. Do not invent files — open the
paths referenced and modify them. Line numbers are approximate (code drifts); match on the
surrounding code, not the line number.

---

## 0. Locked decisions (do not re-litigate)

| Decision | Choice | Why |
|---|---|---|
| Stripe server runtime | **Vercel serverless functions under `/api`** (Node, `@vercel/node`) | App is already a Vite SPA on Vercel; brief specifies `POST /api/create-payment-intent`. No Supabase Edge Functions. |
| Plan scope | **Critical path only**: Stripe payments end-to-end (G1/G5), `/staff` auth gate (G2), CI (G6), Playwright harness + smoke E2E (G3), plus a safe UI/a11y/responsiveness polish pass. | Tighter scope → higher success for a single implementer. |
| Reservations (`ReservationWorkspace`) | **Defer behind a feature flag** — remove from nav, keep files. | 433 lines, no DB table, fixture-only, not in the WBS. Brief decision D1. |
| UI polish depth | **Safe non-breaking fixes + accessibility + responsiveness.** No redesigns, no risky refactors. | User request. |
| Payments in checkout | **Stripe test mode is the checkout path.** The Phase-5 `simulatePayment` stub is retired from checkout. | The whole point of Phase 6. Demo runs on free Stripe test keys (Week-1 item #4). |
| Provider | **Stripe only.** No Stripe Connect (single restaurant, no split payments). | Brief §1, D3. |

**Out of scope for this plan** (do NOT build): sales reports/analytics (G4), kitchen audio
notifications (G7), realtime reconnect UX, subscription tiers (G12), saved cards, item
modifiers, tips, multi-location, production deploy/domain/SSL (G10), Apple/Facebook OAuth,
 Sentry/analytics. These are listed in `PLANNING_README.md` for later phases.

---

## 1. Global rules (apply to every ticket)

1. **Gate before merge.** Every ticket must pass, from the repo root:
   ```bash
   npm run lint && npm run test && npm run build
   ```
   Do not finish a ticket with a red build. Fix the failure or narrow the change.
2. **Code style (enforced by tsconfig):**
   - `verbatimModuleSyntax: true` → use `import type { X }` for type-only imports.
   - `erasableSyntaxOnly: true` → **no** `enum`, `namespace`, or constructor parameter
     properties. Use `as const` objects + union types (see `src/shared/orders/status.ts`).
   - `noUnusedLocals` / `noUnusedParameters` → no dead variables. Prefix intentionally
     unused params with `_` only if the rule allows; otherwise remove them.
   - Path aliases `@/*` → `src/*` and `@shared/*` → `src/shared/*` work **inside `src` only**.
     `/api` functions are compiled separately by Vercel and **must not** import from `src`
     or use these aliases — keep them self-contained (they talk to Supabase via RPC/REST).
3. **Migrations are the source of truth.** Never edit `supabase/schema.sql` by hand. Add a
   numbered file in `supabase/migrations/`, then regenerate the bundle:
   ```bash
   npm run db:bundle
   ```
   Migrations must be **safe to re-run** (use `create ... if not exists`,
   `drop ... if exists`, `do $$ ... exception when duplicate_object`), matching the style of
   `0010_refunds.sql` / `0015_phase5_order_placement.sql`.
4. **Generated DB types.** `src/shared/lib/database.types.ts` is generated. The
   `payments`/`refunds` columns this plan needs (`stripe_payment_intent_id`,
   `stripe_refund_id`, `status`, `amount`, `currency`, `payment_method_type`, `receipt_url`,
   `failure_reason`, `paid_at`, `created_by`) **already exist** in it. If a migration adds a
   new column/table, regenerate types (`npx supabase gen types typescript --linked >
   src/shared/lib/database.types.ts`) or hand-edit the matching `Row`/`Insert`/`Update` blocks
   to stay consistent.
5. **Secrets never reach the browser.** Only `VITE_`-prefixed vars are bundled into the
   client. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY`
   must be **non-`VITE_`** and used only inside `/api` functions. Vite does not expose
   non-`VITE_` vars to the client, and `.env.local` is git-ignored — safe to store them there
   for `vercel dev`.
6. **Money.** DB stores numbers; Stripe uses integer minor units. Convert with
   `Math.round(total * 100)`. Currency for Stripe is lowercase (`'aud'`). Reuse
   `formatMoney`/`roundMoney`/`splitInclusiveTax` from `src/shared/lib/money.ts` on the
   client. Never parse a formatted string back to a number.
7. **Tests ship with code.** Every ticket adds/updates a Vitest (`*.test.ts(x)` next to the
   code) or Playwright test. Match existing patterns:
   - Pure mappers/logic → plain Vitest (`src/**/data/*.test.ts`).
   - Components → React Testing Library + jsdom (see `CheckoutScreen.test.tsx`).
   - Mock Supabase/RPC/fetch; do not hit the network in unit tests.
8. **Do not break the guest funnel.** Customers must be able to order without an account
   (brief D2). Guest = no JWT = `customer_id` null. Everything must work for guests.
9. **Keep changes surgical.** Prefer editing the named file over creating parallel
   abstractions. Follow the surrounding code's naming and structure.

---

## 2. New environment variables

Add to `.env.example` (documented, no secrets) and to `.env.local` (real values, git-ignored).

**Client (bundled — `VITE_` prefix):**
```env
# Stripe publishable key (test mode: pk_test_...). Empty/absent => checkout shows
# "Payments not configured" instead of the payment form.
VITE_STRIPE_PUBLISHABLE_KEY=
```

**Server only (NOT bundled — used by `/api` functions and `vercel dev`):**
```env
STRIPE_SECRET_KEY=            # sk_test_...
STRIPE_WEBHOOK_SECRET=        # whsec_...  (from `stripe listen`)
SUPABASE_URL=                 # same origin as VITE_SUPABASE_URL
SUPABASE_ANON_KEY=            # for user-scoped calls that forward the caller JWT
SUPABASE_SERVICE_ROLE_KEY=    # server-only; bypasses RLS for payments/webhook writes
```

> Note: `SUPABASE_URL`/`SUPABASE_ANON_KEY` mirror the existing `VITE_*` values so functions
> don't depend on client-prefixed names. In Vercel, set all five server vars as **Environment
> Variables** (Production + Preview). `VITE_STRIPE_PUBLISHABLE_KEY` is a build-time var.

---

## 3. Local dev + CI topology (read before Phase B)

The Vite dev server (`npm run dev`, port 5173) does **not** run `/api` functions. To exercise
the payment stack locally you need three things running:

1. **Vite SPA** — `npm run dev` (port 5173). Add a dev proxy so `/api/*` reaches the
   functions (see ticket B1 for the `vite.config.ts` change).
2. **Vercel functions** — `npx vercel dev --listen 3001` (serves `/api/*`). Reads `.env.local`.
3. **Stripe webhook relay** — `stripe listen --forward-to localhost:3001/api/webhooks/stripe`
   (prints the `whsec_...` to put in `STRIPE_WEBHOOK_SECRET`). Trigger events with
   `stripe trigger payment_intent.succeeded`.

For convenience add to `package.json` scripts:
```jsonc
"dev:api": "vercel dev --listen 3001",
"dev:all": "concurrently -n web,api \"npm run dev\" \"npm run dev:api\"",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```
(`concurrently` is a dev dependency added in ticket A2/B1.)

**CI reality:** the core CI job (lint/test/build) needs no services. The Playwright **smoke**
test (QR → menu → add to cart) needs a reachable Supabase; provide `VITE_SUPABASE_URL` +
`VITE_SUPABASE_ANON_KEY` as GitHub Actions **secrets** (the demo project's public URL + anon
key are non-secret by design — RLS protects data). The full **payment** E2E needs Stripe test
keys + a webhook relay and is documented as a manual/local step, not a required CI gate (see
ticket E1).

---

## 4. Dependency graph (critical path in bold)

```
A1 CI ─────────────┐
A2 Playwright ─────┤
A3 /staff gate     │  (independent guardrails — do first)
A4 reservations ───┘

**B1 Stripe deps/env/proxy ─> B2 migration 0016 ─> B3 create-payment-intent ─┐
                                                  └> B4 stripe webhook ───────┤
                                                        B5 API contract doc ◄─┘

**C1 Elements form ─> C2 confirm+order flow ─> C4 3DS/SCA
        │                    │
        ├> C3 failure UI     ├> C5 pending tracking state (needs B4)
        ├> C6 guest checkout ├> C7 history/confirmation real status (needs B4)
        └> C8 Apple/Google Pay (stretch)

**D1 /api/refunds ─> D2 refund webhook (needs B4) ─> D3 admin refund UI wiring

**E1 payment + lifecycle E2E (needs A2, C2, B4)

UI polish + a11y/responsive  ──>  see DEEPSEEK_UI_POLISH_PLAN.md (F1..F8; independent — do after
                                  the critical path or in parallel by a second implementer)
```

Two implementers should stay on the **bold** path at all times.

---

# PHASE A — Guardrails (Week-1 gate). Do these first.

## A1 — GitHub Actions CI (INF-01 / G6)

**Goal:** every PR runs lint + test + build; failures block merge.

**Files to create:**
- `.github/workflows/ci.yml`

**Steps:**
1. Create the workflow:
   ```yaml
   name: CI
   on:
     pull_request:
     push:
       branches: [main]
   jobs:
     quality:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 22
             cache: npm
         - run: npm ci
         - run: npm run lint
         - run: npm run test
         - run: npm run build
   ```
2. Pin Node to match `.nvmrc` (22). `npm ci` uses the committed lockfile.

**Acceptance:**
- Workflow file exists and is valid YAML.
- Running the three commands locally passes on a clean checkout.
- (Human step, note in PR:) enable branch protection on `main` requiring this check — this is
  a repo setting, not code; leave a checklist item in the PR description.

---

## A2 — Playwright harness + smoke E2E (INF-04 / G3)

**Goal:** Playwright configured (Chromium/Firefox/WebKit) with one green smoke test:
customer scans QR → menu renders → item added to cart.

**Files to create:**
- `playwright.config.ts`
- `e2e/customer-smoke.spec.ts`
- `e2e/.gitignore` (ignore `test-results/`, `playwright-report/`)

**Files to modify:**
- `package.json` (devDeps + scripts)
- `.gitignore` (add Playwright artifacts)
- `eslint.config.js` (ignore `playwright-report`, `test-results`)

**Steps:**
1. Install: `npm i -D @playwright/test concurrently` then `npx playwright install --with-deps`.
2. `playwright.config.ts`:
   ```ts
   import { defineConfig, devices } from "@playwright/test";

   export default defineConfig({
     testDir: "./e2e",
     fullyParallel: true,
     retries: process.env.CI ? 2 : 0,
     use: {
       baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
       trace: "on-first-retry",
     },
     projects: [
       { name: "chromium", use: { ...devices["Desktop Chrome"] } },
       { name: "firefox", use: { ...devices["Desktop Firefox"] } },
       { name: "webkit", use: { ...devices["Desktop Safari"] } },
       { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
       { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
     ],
     webServer: process.env.E2E_BASE_URL
       ? undefined
       : {
           command: "npm run dev",
           url: "http://localhost:5173",
           reuseExistingServer: !process.env.CI,
           timeout: 120_000,
         },
   });
   ```
3. `e2e/customer-smoke.spec.ts` — use the documented dev QR entry
   `/?r=quicktab-demo-cafe&t=<table-token>`. The table token is demo data; read it from an env
   var `E2E_TABLE_TOKEN` (document in the spec) or resolve the first active table the same way
   the app's dev fallback does. Assert: menu heading renders, tapping a product opens the
   modal, "Add to Order" increments the cart dock count.
   ```ts
   import { test, expect } from "@playwright/test";

   const slug = process.env.E2E_RESTAURANT_SLUG ?? "quicktab-demo-cafe";
   const token = process.env.E2E_TABLE_TOKEN ?? "";

   test("scan QR -> menu -> add to cart", async ({ page }) => {
     await page.goto(`/?r=${slug}&t=${token}`);
     await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
     const firstProduct = page.getByRole("button", { name: /add|view/i }).first();
     await firstProduct.click();
     await page.getByRole("button", { name: /add to order/i }).click();
     await expect(page.getByText(/item(s)? in your cart/i)).toBeVisible();
   });
   ```
   > Keep selectors resilient (roles/labels, not CSS classes). If the demo menu is empty in a
   > given environment, `test.skip()` with a clear message rather than failing.
4. `package.json` scripts: add `test:e2e`, `test:e2e:ui` (see §3).
5. `.gitignore`: add `test-results/`, `playwright-report/`, `blob-report/`,
   `playwright/.cache/`.
6. `eslint.config.js`: extend `globalIgnores` to `['dist', 'playwright-report', 'test-results']`.

**Acceptance:**
- `npx playwright test --project=chromium` passes locally against `npm run dev` with a
  reachable demo Supabase.
- `npm run lint && npm run build` still pass (config files are excluded from `tsc -b` app
  project; they are covered by `tsconfig.node.json` only if you add them — **do not** add
  `playwright.config.ts` to `tsconfig.app.json`).
- A CI job for Playwright is **added but non-blocking** initially (see A1 note): create
  `.github/workflows/e2e.yml` that runs `npm ci && npx playwright install --with-deps &&
  npx playwright test --project=chromium` with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/
  `E2E_TABLE_TOKEN` from secrets, `continue-on-error: true` until it's stable.

---

## A3 — Gate `/staff` behind auth + role (STF-01 / G2) — **security-critical**

**Goal:** a signed-out visitor to `/staff` gets a sign-in screen (not a dashboard); a signed-in
non-staff user gets a "no access" screen; only `owner`/`manager`/`kitchen` of an active
restaurant see the workspace. Mirror the admin gating stack.

**Background (already in repo):**
- `src/apps/admin/features/auth/AdminGate.tsx` exports `RequireStaff` (authn + membership
  ladder: not-configured → loading → `AdminLogin` → restaurant-loading → error → `NoAccess` →
  children).
- `src/apps/admin/components/RequireRole.tsx` exports `RequireRole({ roles, children })`
  (reads `role` from `useRestaurant()`; renders `RoleBlocked` otherwise).
- `src/shared/restaurant/RestaurantProvider.tsx` provides `useRestaurant()` — **it throws if
  not mounted**, so it must wrap anything using `RequireRole`.
- `src/apps/admin/components/AdminErrorBoundary.tsx` is a reusable error boundary.
- The admin recipe (`AdminDashboard.tsx`): `ErrorBoundary → RestaurantProvider → RequireStaff →
  layout`, with per-route `RequireRole`.

**Files to create:**
- `src/apps/staff/features/auth/StaffGate.tsx` — a thin wrapper that reuses `RequireStaff`'s
  logic but with a **staff** OAuth `redirectTo` (`/staff`) and staff-appropriate copy. Simplest
  correct approach: **export a reusable gate from a shared location** rather than duplicating.
  - Preferred: move/duplicate the `RequireStaff` ladder into
    `src/shared/auth/RequireStaff.tsx` parameterised by `redirectTo` and a `noAccess` slot, then
    have both admin and staff import it. If moving is risky, create `StaffGate.tsx` that imports
    the same building blocks (`useAuth`, `useRestaurant`, `isSupabaseConfigured`) and mirrors
    `AdminGate.tsx` with `redirectTo: ${origin}/staff`.

**Files to modify:**
- `src/routes/AppRoutes.tsx` — wrap the `/staff` route.
- `src/apps/staff/StaffDashboard.tsx` — mount the provider/gate stack around the shell.
- `src/apps/admin/components/RequireRole.tsx` — make `RoleBlocked`'s fallback link
  configurable (optional; default stays `/admin/orders`). For staff, pass a `fallbackTo="/staff"`
  or hide the admin link.

**Steps:**
1. In `AppRoutes.tsx`, the `/staff` route stays lazy but its element becomes the gated
   dashboard. Keep it simple by gating **inside** `StaffDashboard` (mirrors how
   `AdminDashboard` gates inside itself), so the route line is unchanged:
   ```tsx
   { path: "/staff", element: withSuspense(<StaffApp />) }
   ```
2. Rewrite `StaffDashboard.tsx`'s default export to wrap the existing workspace:
   ```tsx
   import { AdminErrorBoundary } from "../admin/components/AdminErrorBoundary";
   import { RestaurantProvider } from "@shared/restaurant/RestaurantProvider";
   import { RequireStaff } from "@shared/auth/RequireStaff"; // or ./features/auth/StaffGate
   import { RequireRole } from "../admin/components/RequireRole";

   const ANY_STAFF = ["owner", "manager", "kitchen"] as const;

   export default function App() {
     return (
       <AdminErrorBoundary>
         <RestaurantProvider>
           <RequireStaff redirectTo="/staff">
             <RequireRole roles={[...ANY_STAFF]}>
               <StaffWorkspace />
             </RequireRole>
           </RequireStaff>
         </RestaurantProvider>
       </AdminErrorBoundary>
     );
   }
   ```
   Move the current body of `App()` (state + `StaffShell` + workspaces) into a new
   `function StaffWorkspace()` in the same file.
3. **Unify restaurant resolution.** Now that `RestaurantProvider` is mounted, the workspace
   should read the restaurant from `useRestaurant()` instead of the ad-hoc
   `fetchMyStaffRestaurantId()` (`src/apps/staff/services/staffOrders.ts`) and the
   `VITE_RESTAURANT_SLUG` lookup (`src/apps/staff/hooks/useStaffWorkspace.ts`). Pass
   `membership.restaurant_id` into `useStaffWorkspace`. This removes the bug where Order
   History could resolve a *different* restaurant than the staff member belongs to.
   - Minimal change: `useStaffWorkspace(restaurantId: string | null)` takes the id from the
     gate; delete the internal slug resolution and the `fetchMyStaffRestaurantId` calls.
4. Add a **sign-out** affordance to `StaffShell` (it currently has none) so a gated user isn't
   stuck. Wire the dead Settings button (line ~49) to sign-out or remove it (see F-phase).
5. Ensure the `RequireStaff` login screen's Google OAuth uses `redirectTo: ${origin}/staff`.

**Tests:**
- `src/apps/staff/StaffDashboard.test.tsx` (new) or extend `src/apps/staff/App.test.tsx`:
  - Signed-out → login screen renders, workspace does **not**.
  - Signed-in non-staff (membership `null`) → `NoAccess` copy renders.
  - Signed-in kitchen → workspace renders.
  - Mock `useAuth` + `useRestaurant` (copy the pattern from
    `src/apps/admin/components/RequireRole.test.tsx` and `src/apps/admin/App.test.tsx`).

**Acceptance:**
- Visiting `/staff` signed-out shows a sign-in screen; **no** restaurant/table/order/reservation
  data renders.
- `npm run test` includes the new gate tests and passes.
- README "Known risk (until Phase 7): `/staff` has no auth gate" is updated to reflect the fix.

---

## A4 — Defer Reservations behind a flag (D1)

**Goal:** hide the fixture-only Reservations surface from the staff nav without deleting code.

**Files to create:**
- `src/apps/staff/flags.ts`:
  ```ts
  /** Reservations have no backing table yet (fixture-only). Hidden until built. Decision D1. */
  export const RESERVATIONS_ENABLED = false;
  ```

**Files to modify:**
- `src/apps/staff/components/StaffShell.tsx` — render the "Reservations"/"Bookings" nav buttons
  only when `RESERVATIONS_ENABLED` (both desktop line ~46 and mobile line ~71).
- `src/apps/staff/StaffDashboard.tsx` — guard `view === "reservations"` render and, if the flag
  is off, coerce a `"reservations"` view back to `"tables"` (so a stale state can't show it).
- `src/apps/staff/types.ts` — keep `"reservations"` in the `View` union (don't break types);
  it's just unreachable when the flag is off.

**Tests:**
- Extend `src/apps/staff/App.test.tsx`: with the flag off, the "Reservations"/"Bookings" nav
  items are not present.

**Acceptance:**
- Reservations is not reachable in the staff UI; `ReservationWorkspace.tsx` and fixtures remain
  in the tree (untouched) for a future phase.
- Lint/test/build pass.

---

# PHASE B — Stripe server foundation (critical path)

## B1 — Stripe deps, server env, shared `/api` lib, dev proxy

**Goal:** install SDKs, add server-only helpers, and make `/api` reachable in dev + production.

**Files to modify:**
- `package.json` — add deps.
- `vite.config.ts` — dev proxy for `/api`.
- `vercel.json` — exclude `/api` from the SPA rewrite.
- `eslint.config.js` — Node-globals override for `/api/**`.
- `.env.example` — document the new vars (§2).

**Files to create:**
- `api/_lib/stripe.ts` — lazily-initialised Stripe client.
- `api/_lib/supabaseAdmin.ts` — service-role + user-scoped Supabase clients.
- `api/_lib/http.ts` — tiny JSON/response + auth-header helpers.
- `api/_lib/env.ts` — read + validate server env.

**Steps:**
1. Install (runtime deps so Vercel bundles them):
   ```bash
   npm i stripe @stripe/stripe-js @supabase/supabase-js
   ```
   `@supabase/supabase-js` is already present; `stripe` (Node SDK) and `@stripe/stripe-js`
   (browser) are new.
2. `vercel.json` — stop the catch-all rewrite from swallowing `/api`:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "rewrites": [
       { "source": "/((?!api/).*)", "destination": "/index.html" }
     ]
   }
   ```
   The negative-lookahead keeps SPA routes (`/admin`, `/staff`, `/order/:n`) working while
   letting `/api/*` hit functions. **Verify** with `vercel dev` that `/api/...` is not rewritten.
3. `vite.config.ts` — add a dev proxy so the SPA on :5173 can call functions on :3001:
   ```ts
   server: {
     proxy: {
       "/api": { target: "http://localhost:3001", changeOrigin: true },
     },
   },
   ```
4. `eslint.config.js` — add an override block (functions run in Node):
   ```js
   {
     files: ['api/**/*.ts'],
     languageOptions: { globals: { ...globals.node } },
     rules: { 'react-refresh/only-export-components': 'off' },
   },
   ```
5. `api/_lib/env.ts`:
   ```ts
   export function serverEnv() {
     const {
       STRIPE_SECRET_KEY,
       STRIPE_WEBHOOK_SECRET,
       SUPABASE_URL,
       SUPABASE_ANON_KEY,
       SUPABASE_SERVICE_ROLE_KEY,
     } = process.env;
     if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY missing");
     if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
       throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
     return {
       STRIPE_SECRET_KEY,
       STRIPE_WEBHOOK_SECRET: STRIPE_WEBHOOK_SECRET ?? "",
       SUPABASE_URL,
       SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ?? "",
       SUPABASE_SERVICE_ROLE_KEY,
     };
   }
   ```
6. `api/_lib/stripe.ts`:
   ```ts
   import Stripe from "stripe";
   import { serverEnv } from "./env";
   let stripe: Stripe | null = null;
   export function getStripe(): Stripe {
     if (!stripe) stripe = new Stripe(serverEnv().STRIPE_SECRET_KEY, { apiVersion: "2025-06-17.baseline" as never });
     return stripe;
   }
   ```
   > Use the SDK's default apiVersion if pinning causes a type error; do not hardcode a version
   > the installed SDK rejects.
7. `api/_lib/supabaseAdmin.ts`:
   ```ts
   import { createClient, type SupabaseClient } from "@supabase/supabase-js";
   import { serverEnv } from "./env";

   /** Bypasses RLS. Server-only. */
   export function adminClient(): SupabaseClient {
     const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
     return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
       auth: { autoRefreshToken: false, persistSession: false },
     });
   }

   /** Runs as the caller (auth.uid() works) by forwarding their JWT with the anon key. */
   export function userClient(accessToken?: string | null): SupabaseClient {
     const { SUPABASE_URL, SUPABASE_ANON_KEY } = serverEnv();
     return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
       auth: { autoRefreshToken: false, persistSession: false },
       global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
     });
   }
   ```
8. `api/_lib/http.ts`:
   ```ts
   import type { VercelRequest, VercelResponse } from "@vercel/node";

   export function json(res: VercelResponse, status: number, body: unknown) {
     res.status(status).json(body);
   }
   export function bearer(req: VercelRequest): string | null {
     const h = req.headers.authorization;
     return h?.startsWith("Bearer ") ? h.slice(7) : null;
   }
   export async function readRawBody(req: VercelRequest): Promise<Buffer> {
     // Webhook signature verification needs the RAW bytes, not req.body (already parsed).
     const chunks: Buffer[] = [];
     for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
     return Buffer.concat(chunks);
   }
   ```
   > Install `@vercel/node` as a dev dep for the types: `npm i -D @vercel/node`. Vercel provides
   > the runtime; the package is only for `VercelRequest`/`VercelResponse` types.
   > **Webhook gotcha:** to get the raw body you may need to disable Vercel's body parsing for
   > that function. Export `export const config = { api: { bodyParser: false } }` from the
   > webhook handler (Next-style) OR read the stream as above. On Vercel Node functions, consume
   > the request stream (as in `readRawBody`) before any JSON parsing.

**Tests:**
- `api/_lib/env.test.ts` (Vitest, Node env): `serverEnv()` throws when a required var is
  missing. Add `// @vitest-environment node` at the top, or place under a Node-env test config.
  If mixing environments is awkward, keep this assertion light (pure function over
  `process.env`).

**Acceptance:**
- `npm run build` still passes (functions are outside `tsconfig.app.json`'s `include: ["src"]`,
  so `tsc -b` ignores them; Vercel compiles them at deploy / `vercel dev`).
- `npm run lint` passes with the new `/api` override.
- `vercel dev` boots and `/api/*` is not rewritten to `index.html`.

---

## B2 — Migration 0016: pending orders + payment write path + webhook RPCs

**Goal:** make orders start as `pending` (unpaid), give the server a way to record a
PaymentIntent, and let the webhook atomically confirm/fail payments. Keep the kitchen from
seeing unpaid orders.

**Files to create:**
- `supabase/migrations/0016_phase6_payments.sql`

**Files to modify (client, to match new semantics):**
- `src/apps/staff/services/staffOrders.ts` — exclude `pending` from the kitchen board query.
- `supabase/schema.sql` — regenerate via `npm run db:bundle` (do not hand-edit).

**Migration contents (write as one re-runnable file):**

1. **`place_order` inserts `pending`.** Replace the function body from `0015` changing only the
   inserted status and the returned status from `'confirmed'` to `'pending'`. Keep the same
   signature `(text, text, text, text, jsonb)`, the same validation/pricing/order-number logic,
   and the same grants. Add a comment: *"Phase 6: orders are created `pending`; the Stripe
   webhook confirms them via `apply_payment_succeeded`."*
   > Because `create or replace function` with an identical signature is allowed, this is a
   > safe in-place edit. Re-`revoke`/`grant execute ... to anon, authenticated` as in 0015.

2. **`record_payment_intent(...)`** — inserts a `payments` row (status `pending`) and stores the
   Stripe intent id. SECURITY DEFINER, granted to `service_role` only.
   ```sql
   create or replace function public.record_payment_intent(
     p_order_id uuid,
     p_amount numeric,
     p_currency text,
     p_stripe_payment_intent_id text,
     p_method text default null
   ) returns uuid
   language plpgsql security definer set search_path = public as $$
   declare v_id uuid; v_method public.payment_method_type;
   begin
     v_method := case p_method
       when 'card' then 'card'::public.payment_method_type
       when 'apple_pay' then 'apple_pay'::public.payment_method_type
       when 'google_pay' then 'google_pay'::public.payment_method_type
       else 'other'::public.payment_method_type end;  -- 'link' and anything else -> other
     insert into public.payments
       (order_id, amount, currency, status, stripe_payment_intent_id, payment_method_type)
     values
       (p_order_id, p_amount, lower(p_currency), 'pending', p_stripe_payment_intent_id, v_method)
     returning id into v_id;
     return v_id;
   end; $$;
   revoke all on function public.record_payment_intent(uuid,numeric,text,text,text) from public;
   grant execute on function public.record_payment_intent(uuid,numeric,text,text,text) to service_role;
   ```

3. **`apply_payment_succeeded(p_stripe_payment_intent_id, p_receipt_url, p_method)`** —
   idempotent: flips the matching `payments` row to `succeeded` (+ `paid_at`, `receipt_url`,
   method) and its order `pending → confirmed`. SECURITY DEFINER, `service_role`.
   ```sql
   create or replace function public.apply_payment_succeeded(
     p_stripe_payment_intent_id text,
     p_receipt_url text default null,
     p_method text default null
   ) returns void
   language plpgsql security definer set search_path = public as $$
   declare v_payment public.payments; v_method public.payment_method_type;
   begin
     select * into v_payment from public.payments
      where stripe_payment_intent_id = p_stripe_payment_intent_id
      for update;
     if not found then return; end if;             -- unknown intent: ignore
     if v_payment.status = 'succeeded' then return; end if;  -- idempotent

     v_method := case p_method
       when 'card' then 'card'::public.payment_method_type
       when 'apple_pay' then 'apple_pay'::public.payment_method_type
       when 'google_pay' then 'google_pay'::public.payment_method_type
       else coalesce(v_payment.payment_method_type, 'other'::public.payment_method_type) end;

     update public.payments
        set status = 'succeeded', paid_at = coalesce(paid_at, now()),
            receipt_url = coalesce(p_receipt_url, receipt_url),
            payment_method_type = v_method
      where id = v_payment.id;

     update public.orders
        set status = 'confirmed'
      where id = v_payment.order_id and status = 'pending';
   end; $$;
   revoke all on function public.apply_payment_succeeded(text,text,text) from public;
   grant execute on function public.apply_payment_succeeded(text,text,text) to service_role;
   ```

4. **`apply_payment_failed(p_stripe_payment_intent_id, p_reason)`** — idempotent: marks payment
   `failed` (+ reason) and cancels the still-`pending` order so unpaid orders don't linger.
   ```sql
   create or replace function public.apply_payment_failed(
     p_stripe_payment_intent_id text,
     p_reason text default null
   ) returns void
   language plpgsql security definer set search_path = public as $$
   declare v_payment public.payments;
   begin
     select * into v_payment from public.payments
      where stripe_payment_intent_id = p_stripe_payment_intent_id for update;
     if not found then return; end if;
     if v_payment.status in ('succeeded','refunded') then return; end if;  -- never regress
     update public.payments set status = 'failed', failure_reason = p_reason
      where id = v_payment.id;
     update public.orders set status = 'cancelled', completed_at = now()
      where id = v_payment.order_id and status = 'pending';
   end; $$;
   revoke all on function public.apply_payment_failed(text,text) from public;
   grant execute on function public.apply_payment_failed(text,text) to service_role;
   ```

5. **`apply_refund_succeeded(p_stripe_refund_id, p_stripe_payment_intent_id, p_amount)`** —
   used by the refund webhook (ticket D2). Marks the payment `refunded` when fully refunded.
   Keep it minimal; the `refunds` row itself is written by `/api/refunds` (D1). Grant to
   `service_role`.

6. Run `npm run db:bundle` to regenerate `supabase/schema.sql`.

**Client change — keep unpaid orders out of the kitchen:**
- `src/apps/staff/services/staffOrders.ts` `fetchStaffOrders(...)`: add `.neq("status", "pending")`
  (or `.in("status", ["confirmed","preparing","ready","completed","cancelled"])`) so orders
  awaiting payment never reach the board. The kitchen should only act on **paid** orders.

**Tests:**
- `supabase/tests/rls_checks.sql` — append a Phase-6 section (manual): assert
  `record_payment_intent`/`apply_payment_succeeded` are **not** executable by `anon`/
  `authenticated` (only `service_role`), and that `place_order` now yields `pending`.
- Update any Vitest that asserted `place_order` returns `confirmed`:
  - `src/apps/customer/data/placeOrder.test.ts` — the mapper default `status ?? "confirmed"`
    can stay, but fixtures that simulate the RPC result should use `"pending"` where they
    represent a freshly placed (unpaid) order. Adjust expectations accordingly.

**Acceptance:**
- Migration applies cleanly to a local Supabase (`npx supabase db reset` then re-import data, or
  run the file in the SQL editor) and is re-runnable.
- `place_order` creates `pending` orders; `apply_payment_succeeded` flips payment→succeeded and
  order→confirmed exactly once (calling it twice is a no-op).
- Kitchen query excludes `pending`.
- `npm run db:bundle` produces an updated `schema.sql`; lint/test/build pass.

---

## B3 — `POST /api/create-payment-intent` (INF-02, CUS-01 backend)

**Goal:** given a cart + table context, create a **pending** order (as the caller, so
`customer_id` is set for signed-in users), record a pending `payments` row, create a Stripe
PaymentIntent, persist its id, and return the `clientSecret` + order info.

**File to create:** `api/create-payment-intent.ts`

**Request body (JSON):**
```jsonc
{
  "restaurantSlug": "quicktab-demo-cafe",
  "tableToken": "<table qr_token>",
  "customerName": "Jane",
  "notes": "No sauce",
  "items": [{ "menu_item_id": "uuid", "quantity": 2 }]
}
```

**Response (200):**
```jsonc
{
  "clientSecret": "pi_..._secret_...",
  "orderId": "uuid",
  "orderNumber": "QT-260105-0001",
  "trackingToken": "hex",
  "amount": 42.0,
  "currency": "AUD",
  "status": "pending"
}
```

**Handler logic:**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getStripe } from "./_lib/stripe";
import { adminClient, userClient } from "./_lib/supabaseAdmin";
import { bearer, json } from "./_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { restaurantSlug, tableToken, customerName, notes, items } = req.body ?? {};
    if (!restaurantSlug || !tableToken || !customerName || !Array.isArray(items) || !items.length)
      return json(res, 400, { error: "invalid_request" });

    // 1) Create the order AS THE CALLER so auth.uid() sets customer_id for signed-in users.
    const user = userClient(bearer(req));
    const { data: placed, error: placeErr } = await user.rpc("place_order", {
      p_restaurant_slug: restaurantSlug,
      p_table_token: tableToken,
      p_customer_name: String(customerName).trim(),
      p_notes: notes ? String(notes).trim() : null,
      p_items: items.map((i: { menu_item_id: string; quantity: number }) => ({
        menu_item_id: i.menu_item_id,
        quantity: Math.trunc(Number(i.quantity)),
      })),
    });
    if (placeErr) return json(res, 400, { error: placeErr.message });

    const orderId = placed.order_id as string;
    const amount = Number(placed.total);           // GST-inclusive total = amount to charge
    const currency = String(placed.currency ?? "AUD");

    // 2) Create the Stripe PaymentIntent (amount in minor units).
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: { orderId, restaurantSlug, tableToken },
    });

    // 3) Persist a pending payments row (service role; anon cannot write payments).
    const admin = adminClient();
    const { error: payErr } = await admin.rpc("record_payment_intent", {
      p_order_id: orderId,
      p_amount: amount,
      p_currency: currency,
      p_stripe_payment_intent_id: intent.id,
      p_method: null,
    });
    if (payErr) {
      // Best-effort cleanup so we don't strand an intent with no row.
      await stripe.paymentIntents.cancel(intent.id).catch(() => {});
      return json(res, 500, { error: "could_not_record_payment" });
    }

    return json(res, 200, {
      clientSecret: intent.client_secret,
      orderId,
      orderNumber: placed.order_number,
      trackingToken: placed.tracking_token,
      amount,
      currency,
      status: "pending",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return json(res, 500, { error: message });
  }
}
```

**Notes:**
- `automatic_payment_methods` lets Stripe surface card + wallet methods (Apple/Google Pay, Link)
  — this is how CUS-08 becomes "real" with no extra code.
- The order is created `pending`; the kitchen won't see it (B2). If the customer never pays, the
  PaymentIntent expires and `apply_payment_failed` (via webhook) cancels it. Document that
  abandoned `pending` orders with no webhook are swept later (out of scope).
- Never trust a client-sent amount — `place_order` recomputes it server-side.

**Tests:**
- `api/create-payment-intent.test.ts` (Vitest, Node env): mock `getStripe`, `adminClient`,
  `userClient`. Assert: 405 on GET; 400 on missing fields; on success, `place_order` is called
  with the mapped items, `paymentIntents.create` gets `amount = round(total*100)` and lowercase
  currency, `record_payment_intent` is called with the intent id, and the response shape matches.
  Assert cleanup cancels the intent if `record_payment_intent` errors.

**Acceptance:**
- `curl -XPOST localhost:3001/api/create-payment-intent` with a valid body (and a demo table
  token) returns a `clientSecret` and creates a `pending` order + `pending` payment row
  (verify in Supabase Studio).
- Lint/test/build pass.

---

## B4 — `POST /api/webhooks/stripe` (INF-03) — signature-verified, idempotent

**Goal:** consume Stripe events, verify the signature, and drive order/payment state.

**File to create:** `api/webhooks/stripe.ts`

**Events handled:**
- `payment_intent.succeeded` → `apply_payment_succeeded(intent.id, receipt_url, method)`.
- `payment_intent.payment_failed` → `apply_payment_failed(intent.id, failure_message)`.
- `charge.refunded` → reconcile refund (ticket D2).

**Handler sketch:**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import { getStripe } from "../_lib/stripe";
import { adminClient } from "../_lib/supabaseAdmin";
import { serverEnv } from "../_lib/env";
import { readRawBody } from "../_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const sig = req.headers["stripe-signature"];
  const { STRIPE_WEBHOOK_SECRET } = serverEnv();
  if (!sig || !STRIPE_WEBHOOK_SECRET) return res.status(400).json({ error: "missing_signature" });

  let event: Stripe.Event;
  try {
    const raw = await readRawBody(req);           // RAW bytes, not req.body
    event = getStripe().webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `invalid_signature: ${(err as Error).message}` });
  }

  const admin = adminClient();
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const method = pi.payment_method_types?.[0] ?? null;
      const receipt = (pi.latest_charge as Stripe.Charge | null)?.receipt_url ?? null;
      await admin.rpc("apply_payment_succeeded", {
        p_stripe_payment_intent_id: pi.id, p_receipt_url: receipt, p_method: method,
      });
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const reason = pi.last_payment_error?.message ?? "Payment failed";
      await admin.rpc("apply_payment_failed", { p_stripe_payment_intent_id: pi.id, p_reason: reason });
      break;
    }
    case "charge.refunded": {
      // Implemented in D2.
      break;
    }
    default:
      break; // acknowledge unhandled events
  }
  return res.status(200).json({ received: true });
}
```

**Notes:**
- `latest_charge` may be an id string; if you need `receipt_url`, expand it when constructing
  the event handling (`stripe.charges.retrieve`) or set `receipt_url` from the charge object if
  expanded. Keep it best-effort — a null receipt is acceptable.
- **Idempotency:** the RPCs already guard on current status, so redeliveries are safe. Do not
  add a separate event-log table for the critical path (note it as a future hardening).
- Return 200 for events you don't handle so Stripe stops retrying.

**Tests:**
- `api/webhooks/stripe.test.ts` (Node env): mock `getStripe().webhooks.constructEvent` to return
  a fabricated `payment_intent.succeeded` event; assert `apply_payment_succeeded` is called with
  the intent id; assert a bad signature yields 400 and no RPC call.

**Acceptance:**
- With `stripe listen --forward-to localhost:3001/api/webhooks/stripe` running,
  `stripe trigger payment_intent.succeeded` flips the matching pending payment→succeeded and
  order→confirmed.
- An unsigned/incorrectly-signed payload returns 400 and changes nothing.
- Lint/test/build pass.

---

## B5 — Phase-6 API contract doc (INF, one page)

**Goal:** a single markdown spec the client/admin build against.

**File to create:** `docs/PAYMENTS_API_CONTRACT.md`

**Contents:** request/response shapes for `/api/create-payment-intent`, `/api/refunds`, the
webhook events consumed, the order-status ↔ payment-status mapping
(`pending`+`pending` → `confirmed`+`succeeded`; `pending`+`failed` → `cancelled`+`failed`),
the `link → other` method mapping, and error codes. Keep it to one page.

**Acceptance:** doc exists and matches the implemented handlers.

---

# PHASE C — Customer Stripe UI (critical path)

> All Phase-C tickets branch on **`VITE_STRIPE_PUBLISHABLE_KEY`**. If it's absent, checkout
> renders an honest "Payments are not configured" notice (no fake buttons). This replaces the
> Phase-5 simulation.

## C1 — Stripe Elements payment form (CUS-01)

**Goal:** replace the four fake method buttons with a real Stripe `PaymentElement`.

**Files to create:**
- `src/apps/customer/data/payments.ts` — `createPaymentIntent(...)` client that POSTs to
  `/api/create-payment-intent` (forwards the Supabase access token if signed in) and returns the
  typed response; a `stripeElementsPromise` helper using `@stripe/stripe-js`'s `loadStripe`.
- `src/apps/customer/features/checkout/StripeCheckout.tsx` — mounts `<Elements>` +
  `<PaymentElement>` + a single "Pay {total}" button.

**Files to modify:**
- `src/apps/customer/features/checkout/CheckoutScreen.tsx` — render `StripeCheckout` when a
  publishable key exists; otherwise the "not configured" notice. Keep the name/notes fields and
  the order summary exactly as-is (the UX diff should be minimal — brief CUS-01).
- `src/apps/customer/types.ts` — keep `SimulatedPaymentMethod` for now (used by `lastOrder`),
  but checkout no longer depends on it.
- `src/apps/customer/data/simulatedPayment.ts` — mark deprecated (or delete if no imports
  remain). Remove its import from `CheckoutScreen.tsx`.

**Client token forwarding (`payments.ts`):**
```ts
import { supabase } from "@shared/lib/supabase";

export async function createPaymentIntent(input: {...}) {
  let token: string | null = null;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  }
  const res = await fetch("/api/create-payment-intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "payment_setup_failed");
  return res.json();
}
```

**Tests:**
- `src/apps/customer/data/payments.test.ts` — mock `fetch` + `supabase.auth.getSession`; assert
  the Authorization header is sent when a session exists and omitted for guests; assert it throws
  on non-OK.
- Update `src/apps/customer/features/checkout/CheckoutScreen.test.tsx` — the old "four simulated
  methods" assertions are replaced: with no publishable key → "not configured" notice; with a key
  (mock `StripeCheckout`) → the payment form renders and the order summary/GST split is unchanged.

**Acceptance:**
- With `VITE_STRIPE_PUBLISHABLE_KEY` set, checkout shows a Stripe PaymentElement and a single Pay
  button; the fake Apple/Google/Link/Card buttons are gone.
- Lint/test/build pass.

---

## C2 — Submit → confirmPayment → order flow (CUS-02)

**Goal:** on Pay, create the intent (server creates the pending order), confirm with Stripe, and
route to the confirmation page. **No phantom orders:** the order exists as `pending`; it only
becomes `confirmed` via the webhook.

**Files to modify:**
- `src/apps/customer/features/checkout/StripeCheckout.tsx` — on submit:
  1. `createPaymentIntent({ restaurantSlug, tableToken, customerName, notes, items })`.
  2. `stripe.confirmPayment({ elements, confirmParams: { return_url: <confirmation url> } })`.
  3. On `error` → surface it (C3). On success → the browser redirects to `return_url`.
- `src/apps/customer/CustomerDashboard.tsx` — the place-order orchestration changes: checkout no
  longer calls `placeOrder()` directly (the API does). Instead, after `createPaymentIntent`,
  store the returned `{orderNumber, trackingToken, ...}` via `saveLastOrder(...)` so the
  confirmation screen can restore after the redirect. Keep the existing `menu_item_unavailable`
  self-heal path by mapping API errors back to `PlaceOrderError` codes.
- `return_url` should be the confirmation route. Since confirmation is in-app state (not a URL
  route), use `${origin}/?paid=1` (or `/order/:orderNumber?token=...`) and have
  `CustomerDashboard` detect the return and restore the last order. **Simplest robust choice:**
  set `return_url` to the tracking URL `trackingUrl(orderNumber, trackingToken)` so the customer
  lands on the live tracking page (which already polls and shows `pending → confirmed`). Then the
  in-app confirmation screen is reached via `saveLastOrder` restore as today.

**Tests:**
- `StripeCheckout.test.tsx` — mock `@stripe/stripe-js` (`loadStripe`, `confirmPayment`); assert
  `createPaymentIntent` is called with the cart, `confirmPayment` receives a `return_url`, and an
  error result renders the failure message without navigating.
- Update `CustomerDashboard`/`App.test.tsx` for the new flow.

**Acceptance:**
- Paying with Stripe test card `4242 4242 4242 4242` creates a pending order, confirms, the
  webhook flips it to confirmed, and the customer sees the confirmation/tracking page.
- A failed confirm does **not** show a confirmed order.
- Lint/test/build pass.

---

## C3 — Payment failure UI + error mapping (CUS-03)

**Goal:** map Stripe error codes to plain-English messages; keep the cart intact on failure.

**Files to create/modify:**
- `src/apps/customer/data/paymentErrors.ts` — pure `mapStripeError(error)` →
  `{ code, message }` covering `card_declined`, `insufficient_funds`/`amount_too_small`,
  `requires_action` (handled in C4), `network_error`, `expired_card`, `incorrect_cvc`, and a
  generic fallback.
- `StripeCheckout.tsx` — render the message in the existing `role="alert"` slot; do **not**
  clear the cart; let the customer retry.

**Tests:** `paymentErrors.test.ts` — table-driven mapping for each code + fallback.

**Acceptance:** declining with `4000 0000 0000 0002` shows "Your card was declined…" and the cart
is unchanged; retry is possible.

---

## C4 — 3-D Secure / SCA (CUS-04)

**Goal:** `confirmPayment` already handles the `requires_action` redirect when you pass
`confirmParams.return_url`. Ensure the flow returns to the app and re-reads status.

**Files to modify:** `StripeCheckout.tsx` / `CustomerDashboard.tsx` — on return from the 3DS
redirect, read `redirect_status` from the URL (`?redirect_status=succeeded|failed|requires_action`)
and reconcile with the tracking poll (webhook is the source of truth).

**Tests:** unit-test the `redirect_status` parser (pure function).

**Acceptance:** test card `4000 0025 0000 3155` (requires auth) completes the 3DS challenge in
Stripe test mode and lands back on tracking; a failed challenge shows the failure UI.

---

## C5 — "Payment pending / webhook not yet confirmed" state (CUS-05)

**Goal:** the tracking page must show a non-error **pending** state while the webhook catches up.

**Files to modify:**
- `src/apps/customer/features/orders/OrderTrackingScreen.tsx` — `pending` is already the first
  `STEPS` entry; ensure the copy reads as "Payment confirming…" rather than an error, and that
  polling continues until it advances. Add a subtle "updating…" affordance using the existing
  (currently unused) `refreshing` flag.

**Tests:** extend `OrderTrackingScreen.test.tsx` — a `pending` order renders the pending step and
keeps polling.

**Acceptance:** immediately after payment (before the webhook), the customer sees "Payment
confirming…", which flips to "Confirmed" within a few seconds.

---

## C6 — Guest checkout still works (CUS-06)

**Goal:** verify guests (no account) can pay. This is mostly a correctness/verification ticket.

**Files to modify:** none expected beyond ensuring `createPaymentIntent` sends no Authorization
header for guests (already handled in C1) and `place_order` sets `customer_id = null`.

**Tests:** `payments.test.ts` guest case (no header). Add a Playwright guest checkout spec
(see E1) if Stripe test env is available.

**Acceptance:** a signed-out customer completes a test payment; the order has `customer_id = null`
and is trackable via the token.

---

## C7 — Real payment status in history + confirmation (CUS-07)

**Goal:** order history and confirmation show real payment status, not just order status.

**Files to modify:**
- `src/apps/customer/data/orders.ts` — select `payments(status, payment_method_type, amount,
  receipt_url)` in `historySelect` and map a `paymentStatus` onto `CustomerOrder`.
- `src/apps/customer/features/orders/OrdersScreen.tsx` — show a payment badge (Paid / Pending /
  Failed / Refunded) using labels, not the raw enum (see F-phase for label maps).
- `src/apps/customer/features/orders/OrderConfirmation.tsx` — replace the "Test mode — no money
  moved." copy with the real status + a receipt link when `receipt_url` exists.

**Tests:** update `orders.test.ts` (mapping) and `OrderConfirmation.test.tsx` (copy/labels).

**Acceptance:** a paid order shows "Paid" + receipt link; a pending order shows "Payment
confirming".

---

## C8 — Apple Pay / Google Pay real buttons (CUS-08, stretch)

**Goal:** with `automatic_payment_methods` enabled (B3) and a PaymentElement, wallet buttons
render automatically on eligible devices/browsers. No custom `PaymentRequest` code needed.

**Files to modify:** `StripeCheckout.tsx` — ensure the PaymentElement is configured to show
wallet methods; add the `apple-pay`/`google-pay` domain verification note to the contract doc
(apple pay requires domain registration in Stripe — a human/dashboard step).

**Acceptance:** on an eligible device, Apple/Google Pay appear in the Elements UI. (Document the
manual Apple Pay domain-verification step; don't block on it.)

---

# PHASE D — Admin Stripe refunds (critical path, G5)

## D1 — `POST /api/refunds` — call Stripe, persist `stripe_refund_id` (ADM-04)

**Goal:** replace the client-side `refunds` insert with a server call that charges a real Stripe
refund and writes the row with `stripe_refund_id` + real status.

**File to create:** `api/refunds.ts`

**Request:** `{ orderId, paymentId, amount, reason, orderItemId?, quantity? }` + caller JWT.

**Handler logic:**
1. Authorise: `supabase.auth.getUser(jwt)` → user id; with `adminClient()`, verify the user is an
   `owner`/`manager` of the order's restaurant (query `restaurant_staff` join `orders`). Reject
   otherwise (403). **Never trust the client's role claim.**
2. Load the `payments` row → `stripe_payment_intent_id`. If null → 400 ("no stripe payment").
3. `stripe.refunds.create({ payment_intent, amount: round(amount*100), metadata:{orderId,...} })`.
4. Insert the `refunds` row (service role) with `stripe_refund_id = refund.id`, `status` mapped
   from Stripe (`succeeded`→`succeeded`, `pending`→`requested`, `failed`→`failed`), `created_by =
   userId`. The existing DB guards (`guard_refund_amount`, `guard_refund_quantity`) still enforce
   caps — if Stripe succeeds but the DB guard rejects, surface the error (log for reconciliation).
5. Return the created refund row.

**Files to modify (client):**
- `src/shared/data/refunds.ts` — add `requestStripeRefund(input)` that POSTs to `/api/refunds`
  with the caller's access token (mirror `payments.ts`). Keep `createRefund` only if a
  no-Stripe fallback is desired; otherwise route the admin UI through `requestStripeRefund`.
- `src/apps/admin/hooks/useRefunds.ts` — call `requestStripeRefund` instead of `createRefund`.
- `src/apps/admin/features/orders/OrderDetailPage.tsx` — remove the hardcoded
  `status: "succeeded"`; the server sets the real status. Update the confirm-dialog copy that says
  "Stripe is not called yet" (line ~169) and the section note "Stripe refund not yet processed"
  (line ~345).

**Tests:**
- `api/refunds.test.ts` (Node env): mock Stripe + Supabase; assert 403 for a non-staff caller,
  400 when no intent id, and on success `stripe.refunds.create` is called with minor-unit amount
  and the row is inserted with `stripe_refund_id`.
- Update `src/apps/admin/hooks/useRefunds.test.tsx` for the new call path.

**Acceptance:** issuing a refund in admin creates a Stripe test refund, `refunds.stripe_refund_id`
is populated, and the payment/order reflect it. Lint/test/build pass.

---

## D2 — Refund webhook transitions (ADM-05)

**Goal:** on `charge.refunded`, reconcile the payment/refund status (handles refunds issued
outside the app and partial refunds).

**Files to modify:** `api/webhooks/stripe.ts` — implement the `charge.refunded` case: look up the
payment by `charge.payment_intent`, call `apply_refund_succeeded(...)` (B2 step 5) to mark the
payment `refunded` when the charge is fully refunded; for partial refunds leave the payment
`succeeded` (the `refunds` rows carry the detail).

**Tests:** extend `api/webhooks/stripe.test.ts` with a `charge.refunded` event.

**Acceptance:** a Stripe-side refund updates the QuickTab payment/refund status; redelivery is a
no-op.

---

## D3 — Admin order detail shows real payment + Stripe ids (ADM-06)

**Goal:** the Payments section already renders rows; surface `stripe_payment_intent_id`,
`stripe_refund_id`, `created_by`, and human-readable status labels.

**Files to modify:**
- `src/apps/admin/features/orders/OrderDetailPage.tsx` — add status label maps (no raw enum),
  show the refund's `created_by` (resolve to a name via the staff directory if cheap) and the
  Stripe ids (truncated, copyable). Remove the stale footnote "Payment rows are written by the
  payment provider and read-only here." only if it's now misleading; otherwise keep.
- `src/apps/admin/flags.ts` — fix the stale comment above `REFUNDS_ENABLED` (it says refunds are
  "hidden until the Stripe refund call is wired" while the value is `true`). Update the comment to
  reflect that refunds now call Stripe.

**Tests:** update `OrderDetailPage.test.tsx` for the new labels/ids.

**Acceptance:** a paid+refunded order shows intent id, refund id, method, and labelled statuses.

---

# PHASE E — End-to-end payment coverage

## E1 — Playwright: order lifecycle + payment (STF-10)

**Goal:** an E2E that places an order as a customer and asserts it appears on the kitchen board,
advances status, and the customer sees the change.

**Files to create:** `e2e/order-lifecycle.spec.ts`.

**Approach:**
- The **non-payment** lifecycle (place a pending order via a seeded paid fixture, or use a Stripe
  test card) → assert kitchen board (signed-in staff) shows it → advance status → assert tracking
  reflects it.
- Full card payment requires Stripe test keys + a webhook relay; mark that spec
  `test.describe.configure({ mode: 'serial' })` and gate it behind `process.env.STRIPE_TEST ===
  "1"` so CI without Stripe skips it. Document the local run command in the spec header.

**Acceptance:** the lifecycle spec passes locally with the dev stack (§3); the payment variant
passes when Stripe test env is present. Core CI stays green (payment variant skipped without
secrets).

---

# PHASE F — UI polish, accessibility, responsiveness → split out

The UI polish / accessibility / responsiveness track has been **moved to a standalone plan** so
this critical-path document stays lean:

**➡️ `DEEPSEEK_UI_POLISH_PLAN.md`**

It is a catalog of ~50 safe, non-breaking fixes (items **F1–F8**) across the customer, staff, and
admin apps — dead CSS, raw-enum labels, the 9px confirmation-fallback bug, hardcoded strings and
currency, the fake "Service live" badge, missing skeletons, modal focus-trap/Escape, `aria-live`
regions, tap-target sizing, contrast, and tablet-landscape kitchen density. None of it is on the
payment critical path. Do it **after** Phases A–E merge, or **in parallel** by a second
implementer (coordinating on shared files). The same gate applies: `npm run lint && npm run test
&& npm run build`.

---

## Appendix 1 — Stripe test cards (Week-1 item #4)

| Card | Behaviour |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 0002` | Declined |
| `4000 0025 0000 3155` | Requires 3-D Secure / authentication |
| `4000 0000 0000 9995` | Insufficient funds |

Any future expiry, any CVC, any postcode. Use `stripe trigger payment_intent.succeeded` /
`payment_intent.payment_failed` / `charge.refunded` to exercise webhooks without a browser.

## Appendix 2 — Files created / modified (index)

**Created:** `.github/workflows/ci.yml`, `.github/workflows/e2e.yml`, `playwright.config.ts`,
`e2e/customer-smoke.spec.ts`, `e2e/order-lifecycle.spec.ts`, `e2e/.gitignore`,
`api/_lib/{env,stripe,supabaseAdmin,http}.ts`, `api/create-payment-intent.ts`,
`api/webhooks/stripe.ts`, `api/refunds.ts`, `supabase/migrations/0016_phase6_payments.sql`,
`docs/PAYMENTS_API_CONTRACT.md`, `src/apps/staff/flags.ts`,
`src/apps/staff/features/auth/StaffGate.tsx` (or `src/shared/auth/RequireStaff.tsx`),
`src/apps/customer/data/payments.ts`, `src/apps/customer/data/paymentErrors.ts`,
`src/apps/customer/features/checkout/StripeCheckout.tsx`,
`src/shared/orders/paymentLabels.ts`.

**Modified (highlights):** `package.json`, `vercel.json`, `vite.config.ts`, `eslint.config.js`,
`.env.example`, `.gitignore`, `src/routes/AppRoutes.tsx`, `src/apps/staff/StaffDashboard.tsx`,
`src/apps/staff/components/StaffShell.tsx`, `src/apps/staff/hooks/useStaffWorkspace.ts`,
`src/apps/staff/services/{staffOrders,staffTables}.ts`,
`src/apps/customer/features/checkout/CheckoutScreen.tsx`,
`src/apps/customer/CustomerDashboard.tsx`,
`src/apps/customer/features/orders/{OrderTrackingScreen,OrderConfirmation,OrdersScreen}.tsx`,
`src/apps/customer/data/orders.ts`, `src/apps/customer/types.ts`,
`src/shared/data/refunds.ts`, `src/apps/admin/hooks/useRefunds.ts`,
`src/apps/admin/features/orders/OrderDetailPage.tsx`, `src/apps/admin/flags.ts`.
`supabase/schema.sql` regenerated (not hand-edited). The UI-polish track (F1–F8) touches many more
files and is indexed in `DEEPSEEK_UI_POLISH_PLAN.md`.

## Appendix 3 — Milestone M6 (Payment Integration Complete) exit criteria

All must be true:
- A Stripe **test-mode** payment succeeds end-to-end: customer pays → `payments` row
  `succeeded` with a real `stripe_payment_intent_id` → order `pending → confirmed`.
- The webhook endpoint **verifies signatures** and rejects an unsigned payload (400).
- A refund issued from admin **calls Stripe**, and `refunds.stripe_refund_id` is populated.
- `/staff` is auth-gated (A3) and reservations are hidden (A4).
- CI (lint/test/build) is green and merge-blocking; the Playwright smoke test passes.
- `npm run lint && npm run test && npm run build` pass locally.

## Appendix 4 — Risks & mitigations (critical path)

| Risk | Mitigation encoded in this plan |
|---|---|
| Webhook race: customer redirected before the order flips to confirmed | Order is created `pending` up-front (B3); tracking shows a "Payment confirming…" state (C5) and polls; webhook is the source of truth (B4). |
| `place_order` runs as the caller so `customer_id` is set | `/api/create-payment-intent` forwards the caller JWT to a user-scoped Supabase client (B1/B3); guests get `customer_id = null`. |
| Raw-body webhook signature verification fails on Vercel | Read the request **stream** for raw bytes (`readRawBody`, B1/B4); don't use the pre-parsed `req.body`. |
| Unpaid `pending` orders linger | `payment_intent.payment_failed` cancels the order (B2/B4); PaymentIntent expiry + a future sweep job (noted, out of scope). |
| Kitchen sees unpaid orders | Staff kitchen query excludes `pending` (B2). |
| `/api` swallowed by the SPA rewrite | Negative-lookahead rewrite in `vercel.json` (B1) + verify under `vercel dev`. |
| Secrets leak to the client | Only `VITE_STRIPE_PUBLISHABLE_KEY` is client-side; secret/service keys are non-`VITE_` and server-only (B1, §2). |
| Playwright flakiness blocks CI | Core CI is lint/test/build only; e2e is a separate non-blocking job; payment E2E gated behind `STRIPE_TEST=1` (A2/E1). |
| `link` is not a DB `payment_method_type` | Map `link`/unknown → `other` in `record_payment_intent` and the webhook (B2/B4). |

## Appendix 5 — Suggested PR sequencing (2 implementers)

1. **PR-1 (guardrails):** A1 + A2 + A3 + A4. Merge first; everything after is protected.
2. **PR-2 (Stripe server):** B1 → B2 → B3 → B4 → B5.
3. **PR-3 (customer Stripe):** C1 → C2 → C3 → C4 → C5 → C6 → C7 (→ C8 stretch).
4. **PR-4 (admin refunds):** D1 → D2 → D3.
5. **PR-5 (E2E):** E1.
6. **PR-6+ (UI polish):** see `DEEPSEEK_UI_POLISH_PLAN.md` — F1–F8, split customer / staff /
   admin / cross-cutting. Off the critical path; run after or in parallel.

Keep each PR green on `npm run lint && npm run test && npm run build` before opening the next.
```
