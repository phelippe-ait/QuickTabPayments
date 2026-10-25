# QuickTab Admin — Supabase Integration & Planning Brief

> **Audience:** Qwen 3.8 Max (planning) → DeepSeek V4.1 Flash (implementation)
> **Goal:** produce an implementation-ready plan that makes the admin app fully Supabase-backed.
> **Date:** 21 October 2026
> **Branch:** `feature/admin-app`

---

## 0. How to use this document

1. Read the whole brief before answering.
2. If you have repository access, inspect the paths listed in §12. If not, treat this brief as the source of truth.
3. Ask **at most five** clarifying questions, and only if a decision truly blocks the plan.
4. Produce a plan, not code. DeepSeek will implement it.
5. Use the exact output format in §8.
6. Explicitly audit the admin app (§7) and include every confirmed issue in a milestone, or state why it is out of scope.

---

## 1. Hard requirement

**Every piece of data the admin app displays or changes must come from Supabase and survive a page refresh.**

That includes:

- restaurant profile and branding
- menu categories and items, including images
- tables and their QR codes
- staff members, roles and active status
- orders, line items, payments, refunds and statistics

No fixture data may remain in any admin runtime path. A hard refresh must show the same state. If Supabase is unreachable, the UI must show an error and a retry action — never silently fall back to mock data.

**Definition of connected (acceptance):**

- [ ] Creating/editing/deleting a menu item persists after reload.
- [ ] Uploading an image produces a Storage object and the public URL is stored in the DB.
- [ ] Category renames do not orphan items.
- [ ] Table CRUD persists; QR encodes the real `qr_token` and restaurant slug.
- [ ] Orders come from the DB with real line items and payment rows.
- [ ] Status changes and cancellations persist and follow the allowed transitions.
- [ ] Staff list shows real profiles from `restaurant_staff`; role changes persist.
- [ ] Statistics are computed from the DB, not hardcoded.
- [ ] Signed-out users see login; non-staff see onboarding/no-access; kitchen role is restricted.
- [ ] `grep -R "fixtures\|starterOrders\|starterItems\|starterTables\|starterUsers" src/apps/admin` returns only tests/seed helpers, not runtime code.
- [ ] `npm run build`, `npm run lint`, `npm test` pass.
- [ ] Customer and staff apps still build and behave unchanged.

---

## 2. Repository and stack

- One repo, one Vite build, three surfaces:
  - customer — `/`
  - staff — `/staff`
  - admin — `/admin`
- React 19, Vite 8, TypeScript 6, React Router 8 (`createBrowserRouter`), TanStack Query v5, Tailwind 4 with design tokens, Supabase JS, `qrcode`, Vitest + Testing Library.
- Node 22.12+.
- Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm test`.
- Admin styling: CSS Modules in `src/apps/admin/App.module.css`. Shared components use Tailwind design tokens.
- Migrations: `supabase/migrations/0001_profiles.sql` … `0004_rls_policies.sql`.

### Supabase project status (verified 21 Oct 2026)

- `.env.local` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Supabase Auth responds; email/password and Google are enabled; Apple is disabled.
- REST API reachable.
- Existing demo data: one active restaurant **“QuickTab Demo Café”** (`quicktab-demo-cafe`), one category, one available item, one table `T01` with a `qr_token`.
- Anonymous reads of `orders` and `restaurant_staff` return zero rows — this is correct RLS behaviour, not missing data.
- The Supabase CLI is **not authenticated** here. Migrations must be applied manually in the SQL editor, and DB types are hand-maintained. Any plan must include the exact manual steps.

---

## 3. Current state of the admin app

### 3.1 Implemented and working

| Area | Files |
| --- | --- |
| Auth gate (login, onboarding, no-access, loading, error) | `src/apps/admin/features/auth/AdminGate.tsx` |
| Restaurant context, role, display helpers | `src/shared/restaurant/RestaurantProvider.tsx` |
| Typed data layer (restaurants, menu, tables, orders, staff) | `src/shared/data/*.ts` |
| Full hand-written DB types (15 tables + enums) | `src/shared/lib/database.types.ts` |
| TanStack Query provider | `src/main.tsx` |
| Real restaurant/user identity, role-aware nav, sign-out | `src/apps/admin/components/layout/AdminShell.tsx`, `AdminDashboard.tsx` |
| Gate and role tests | `src/apps/admin/App.test.tsx` |

- One restaurant per user for launch; `fetchMemberships` already returns a list for future switching.
- Onboarding creates a restaurant plus owner membership using existing RLS.
- Kitchen role sees only order history.
- These foundation changes are currently **uncommitted** on `feature/admin-app`.

### 3.2 Still a prototype

| Screen | Current source |
| --- | --- |
| Catalog | `src/apps/admin/data/fixtures.ts`, `src/apps/admin/hooks/useAdminWorkspace.ts` |
| Tables | same fixtures + `useAdminWorkspace` |
| Users | same fixtures + `useAdminWorkspace` |
| Orders | `starterOrders` inside `src/apps/admin/features/orders/OrdersPage.tsx` |
| Stats | hardcoded numbers in `OrdersPage.tsx` |
| Refunds/cancel | local state only |

- Sections are local React state: no deep links (`/admin/orders/:id`) and no settings route.
- Admin UI types use numeric IDs (`src/apps/admin/types.ts`); the database uses UUIDs.

---

## 4. Data model and mapping

### 4.1 Tables that matter

| Table | Key columns / constraints |
| --- | --- |
| `profiles` | `id` = auth user, `email`, `first_name`, `last_name`, `phone`, `role` (global), timestamps |
| `roles` | lookup for `profiles.role` (`customer`, `staff`, `manager`, `admin`) |
| `restaurants` | `owner_id`, `slug` unique, `name`, `description`, `logo_url`, `cover_image_url`, address/phone/email, `currency`, `timezone`, `tax_rate` 0–1, `is_active` |
| `restaurant_staff` | `restaurant_id`, `user_id`, `role` (`owner`, `manager`, `kitchen`), `is_active`, unique restaurant+user |
| `tables` | `restaurant_id`, `table_number` unique per restaurant, `qr_token` unique (16 hex), `location_label`, `is_active` |
| `menu_categories` | `restaurant_id`, `name`, `description`, `image_url`, `display_order`, `is_active` |
| `menu_items` | `restaurant_id`, `category_id` **not null, on delete restrict**, `name`, `description`, `price numeric(10,2)`, `image_url`, `is_available`, `display_order`, `prep_time_minutes`, `allergens text[]` |
| `orders` | `restaurant_id`, `table_id`, `customer_id`, `order_number` unique per restaurant, `status` enum, subtotal/tax/total, notes, pickup estimate, timestamps, `completed_at` |
| `order_items` | order, menu item, name/price snapshots, quantity, subtotal, notes |
| `payments` | order, Stripe intent, `status` (`pending/succeeded/failed/refunded`), amount, currency, method type, receipt URL, failure reason, paid_at |
| Other | `modifier_groups`, `modifiers`, `menu_item_modifier_groups`, `qr_sessions` |

### 4.2 UI → DB mapping (drives the refactor)

| Admin UI today | Database |
| --- | --- |
| `MenuItem.id: number` | `menu_items.id uuid` |
| `category: string` | `category_id uuid` → `menu_categories` |
| `image` (Data URL) | `image_url` (Storage public URL) |
| `available` | `is_available` |
| `CafeTable.number` | `table_number` |
| `CafeTable.location` | `location_label` |
| `CafeTable.available` | **no column** — derive occupied from open orders; `is_active` means enabled |
| `CafeTable.seats` | **no column** — add one or remove the field |
| `currentOrder`, `seatedAt` | derive from `orders` (latest open order) |
| `User.role` (`Staff/Manager/Admin`) | `restaurant_staff.role` (`owner/manager/kitchen`) |
| `User.status` | `restaurant_staff.is_active` |
| `User.name/email/initials` | `profiles.first_name/last_name/email` (RLS-blocked today) |
| `Order.id` (`#1048`) | `orders.order_number` |
| `Order.date` (display string) | `orders.created_at` + restaurant timezone |
| `Order.total` (`"$12.40"`) | `orders.total` numeric + currency |
| `Order.status` (3 values) | 6-value `order_status` enum |
| `Order.payment` | `payments` rows (method type, receipt) |
| `Order.refundedAmount` | aggregate of a refunds table (does not exist) |
| `lineItems` | `order_items` |

### 4.3 Status model

DB enum: `pending → confirmed → preparing → ready → completed`, plus `cancelled`.

The plan must define:

- display labels for each state,
- allowed transitions per role,
- which transitions trigger `completed_at`,
- how cancellation interacts with refunds,
- one shared mapping module so customer/staff can reuse it later.

### 4.4 RLS summary and blockers

| Table | Read | Write |
| --- | --- | --- |
| `restaurants` | anyone, active only | **owner only** |
| `restaurant_staff` | self, or owner of the restaurant | owner only |
| `tables` | anyone, active only | any active staff |
| `menu_categories` / `menu_items` | active / available only | any active staff |
| `orders` | own orders or staff of restaurant | staff; customer can cancel own pending |
| `order_items` | via parent order | staff, or customer while pending |
| `payments` | own or staff | **service role only** |
| `profiles` | **own row only** | own row only |
| `qr_sessions` | public | public |

Blockers to solve explicitly:

1. **Staff directory is impossible** with current `profiles` RLS. Propose a policy or a `security definer` RPC that checks `auth.uid()` and shares a restaurant. Include supporting indexes and an RLS test.
2. **Managers cannot edit restaurant settings** (`restaurants` is owner-only). Decide: document owner-only, or add a migration.
3. **No refunds storage.** Add a `refunds` table (or equivalent) now; payments writes remain service-role only.
4. **No Storage buckets/policies.** Needed for logos, covers, menu images.
5. **No seat count** in `tables`.
6. **No customer name snapshot** in orders, and profile joins are RLS-blocked; decide the display fallback.
7. **Invites require the service role.** Compare approaches and recommend one: Edge Function with `service_role`, admin-invite RPC, or “add existing profile by email” for the demo.

---

## 5. Cross-app invariants

We only modify the admin app now, but the other apps must not need rework later.

- The database is the shared contract.
- **Do not modify `src/apps/customer/**` or `src/apps/staff/**`.**
- Shared changes under `src/shared/**` must be additive and backward compatible.
- Each milestone must leave the whole repo building and testing.
- The customer app still reads mock data from `src/apps/customer/data/menu.ts` (including a hardcoded `tableNumber = 3`), and the staff app still uses fixtures. Admin edits will therefore persist to Supabase but will **not** appear in those apps until they are wired later. That is expected and out of scope; state it in the plan so the demo is not over-promised.
- Define these contracts in the plan, even if consumers are wired later:

1. **QR URL** — one canonical helper built from restaurant `slug` + table `qr_token`. Current helper uses table number only (`src/apps/admin/features/tables/tableQr.utils.ts`). Choose a format, add tests, document that the customer app must resolve it later.
2. **Order status** — shared mapping and transition rules.
3. **Money** — numbers in DB; format with `Intl.NumberFormat` using restaurant `currency`; never parse formatted strings.
4. **Storage paths** — e.g. `restaurant-assets/{restaurant_id}/logo.webp`, `.../cover.webp`, `menu-items/{restaurant_id}/{item_id}.webp`; public read, staff-gated writes, 5 MB, JPEG/PNG/WebP.
5. **Realtime** — channel/filter naming if included (stretch).
6. **Staff roles** — `restaurant_staff.role` is authorization; `profiles.role` is the global account role. Do not conflate them.
7. **Order numbers** — who generates them, uniqueness per restaurant, format. Admin does not create orders, but seeds and the future customer app need a rule.

Add an appendix: “Changes the customer/staff apps will need later” — no code now.

---

## 6. Decisions already made

- Single restaurant per user at launch.
- TanStack Query for server state.
- Keep admin CSS Modules; do not migrate to Tailwind/shadcn.
- Refunds: real schema + UI now, stub the Stripe call; wire after Phase 6.
- Optimize for a demo-ready admin this week; cut scope rather than quality.
- No heavy new dependencies without justification.

---

## 7. Audit findings to verify and plan fixes for

Confirm each finding in code, then map it to a milestone. Add anything else you find.

### P0 — blocks the “connected” requirement

| # | Finding | Where |
| --- | --- | --- |
| 1 | All admin screens are fixture-backed; changes vanish on reload | `useAdminWorkspace.ts`, `OrdersPage.tsx`, `data/fixtures.ts` |
| 2 | Refund, cancel and stats are fake | `OrdersPage.tsx` |
| 3 | User roles (`Staff/Manager/Admin`) do not exist in `restaurant_staff`; “Add user” cannot create an auth account | `features/users/UserDialog.tsx` |
| 4 | QR encodes table number, not `qr_token` + slug; printable sheet hardcodes “Café Shop” | `features/tables/tableQr.utils.ts`, `TablesPage.tsx` |
| 5 | Staff names/emails are unreadable because `profiles` RLS is self-only | `0001_profiles.sql`, `0004_rls_policies.sql` |
| 6 | No refunds schema; refunds cannot be persisted | migrations |
| 7 | No Storage buckets or upload policies | migrations |
| 8 | Restaurant profile edits are owner-only; managers are blocked by RLS | `0004_rls_policies.sql` |

### P1 — correctness and data integrity

| # | Finding | Where |
| --- | --- | --- |
| 9 | Category deletion silently moves items to the first section; DB uses `on delete restrict` | `useAdminWorkspace.ts` |
| 10 | Image upload stores a base64 Data URL in React state — not persisted, large memory | `CatalogDialogs.tsx` |
| 11 | Status model mismatch (3 UI states vs 6 DB states); running-time parser assumes display strings | `orders/order.utils.ts` |
| 12 | Refund math parses `"$"` strings and keys quantities by item name (collides with duplicate names); refunds allowed on unpaid/active orders | `OrdersPage.tsx` |
| 13 | Stats are hardcoded | `OrdersPage.tsx` (around the stats cards) |
| 14 | Table “available/occupied” conflates occupancy with `is_active`; no seats column; number normalisation differs from existing `T01` | `TableDialog.tsx`, `TablesPage.tsx` |
| 15 | No pagination; the data layer caps orders at 100 | `src/shared/data/orders.ts` |
| 16 | Categories are strings; rename cascades by name, not ID | `types.ts`, `useAdminWorkspace.ts` |
| 17 | Copy still says “Café Shop” in Users and QR sheet | `UsersPage.tsx`, `TablesPage.tsx` |
| 18 | Fake success toasts fire immediately; errors are never surfaced | `useAdminWorkspace.ts`, `AdminDashboard.tsx` |
| 19 | `Date.now()` used as an ID; collisions possible | `CatalogDialogs.tsx`, `UserDialog.tsx`, `TableDialog.tsx` |

### P2 — UX, accessibility, tests

| # | Finding | Where |
| --- | --- | --- |
| 20 | Modals lack `role="dialog"`, `aria-modal`, focus trap and Escape handling | all dialogs, order detail |
| 21 | Order rows use `role="button"` while containing a checkbox and buttons (nested interactive); Space key not prevented | `OrdersPage.tsx` |
| 22 | Oversized image uses blocking `window.alert` | `CatalogDialogs.tsx` |
| 23 | Mobile menu lacks `aria-expanded`; nav lacks `aria-current` | `AdminShell.tsx` |
| 24 | Decorative/meaningful image `alt` text inconsistent | catalog, order lines |
| 25 | Tests cover only the gate; no data layer/page tests | `App.test.tsx` |
| 26 | DB types are hand-maintained and can drift | `database.types.ts` |
| 27 | No error boundary; a render error blanks the admin | app root |
| 28 | CSV export formula-injection protection is present — keep it | `OrdersPage.tsx` |

Also check for: inaccessible modals in `SectionsModal`, focus return after close, keyboard selection in tables, and mobile layout regressions.

---

## 8. Required plan output

Start with **at most five clarifying questions**. Then:

1. **Milestones M1…Mn**, each ≤1 working day, independently shippable, in dependency order.
2. Per milestone:
   - Goal and user-visible outcome.
   - Preconditions.
   - Exact files to add/modify.
   - Data-layer functions with signatures and query keys.
   - DB changes: migration filename, idempotent SQL summary, RLS policies, indexes.
   - UI changes and role gating.
   - Cross-app impact.
   - Acceptance criteria (testable).
   - Tests: unit, integration, RLS SQL checks, manual QA.
   - Demo step unlocked.
   - Risks and rollback.
3. **Ordered commit sequence** with messages.
4. **Definition of demo-ready** checklist and a 10-minute demo script.
5. **Seed-data plan**: realistic café, owner/manager/kitchen users, categories, items, tables, open/completed orders, payments.
6. **Audit resolution matrix**: every P0/P1/P2 finding → milestone, or “out of scope” with reason.
7. **Cross-app contract appendix** with exact strings/formats.
8. **Open decisions** the human must confirm.

---

## 9. Scope

### Must have

1. Routing foundation — deep-linkable `/admin/catalog`, `/admin/tables`, `/admin/users`, `/admin/orders`, `/admin/orders/:id`, `/admin/settings`; each page owns its queries and dialogs.
2. Settings — restaurant profile CRUD + logo/cover uploads.
3. Catalog — categories + items CRUD, availability, image upload, ordering, safe delete.
4. Tables — CRUD, QR from token + slug, printable sheet, derived occupancy, seats decision.
5. Orders — paginated list, filters, detail with line items/payment, status transitions, cancel, refund stub + schema, real stats.
6. Staff — real list, role changes, deactivation; minimum viable invite path.
7. QA — loading/error/empty states, validation, truthful toasts, accessibility pass, tests, seed data.

### Stretch

- Realtime order feed.
- Dashboard overview page.
- CSV export from real data.
- Bulk actions against the DB.

### Out of scope

- Stripe payment-intent/webhook work.
- Modifier management UI.
- Multi-restaurant switching.
- Customer/staff refactors.
- Visual redesign or shadcn migration.
- Playwright E2E.

### Cut order if time slips

1. Realtime
2. Staff invites
3. Dashboard overview
4. CSV export
5. Refund UI (keep read-only payment status)

---

## 10. Recommendation seeds — accept or reject each with one line

- Do the routing refactor first; every later page needs query and dialog ownership.
- Add `useMenu`, `useTables`, `useOrders`, `useStaff`, `useRestaurantSettings` hooks so components never call Supabase directly.
- Add `mappers.ts` to convert DB rows → view models; keep `src/apps/admin/types.ts` free of DB concerns.
- Centralise status labels/transitions in `src/shared/orders/status.ts`.
- Use `useMutation` + `queryClient.invalidateQueries` consistently; surface errors in toasts.
- Add a `refunds` table with status and `created_by`; keep writes service-role only later.
- Add a Storage migration with 5 MB and MIME limits; public read, staff-gated writes.
- Fix `profiles` visibility with a `security definer` RPC or policy; include indexes and a test.
- Use a Postgres RPC for atomic restaurant onboarding instead of two client writes.
- Add `tables.seats` **or** remove the field from the UI — do not leave it fake.
- Add an `order_number` generator contract even if only seeds use it.
- Seed via SQL/script; do not rely on manual clicking.
- Keep refunds behind a flag until Stripe is live.
- Ship CRUD before realtime.
- Do not add zod/react-hook-form unless the 3-day budget clearly allows it.

---

## 11. Environment and manual steps

- Apply new migrations in order after `0004` using the Supabase SQL editor (CLI not authenticated).
- Regenerate types when possible:

  `npx supabase gen types typescript --project-id <ref> > src/shared/lib/database.types.ts`

  Otherwise update `src/shared/lib/database.types.ts` by hand and note it.
- Verify the demo auth user has an active `restaurant_staff` row for `quicktab-demo-cafe` before the demo.
- Never put a `service_role` key in client code or Vite env vars.
- The current bundle-size warning is pre-existing and not a blocker.

---

## 12. File map

```
src/
  apps/admin/
    AdminDashboard.tsx                  # gate + workspace + modals
    App.module.css                      # all admin styles
    App.test.tsx                        # gate/role tests
    types.ts                            # UI types (numeric IDs) — to be replaced by view models
    components/AdminUi.tsx              # PageHeader, EmptyState, ConfirmDialog, SelectionBar
    components/layout/AdminShell.tsx
    data/fixtures.ts                    # mock data — remove from runtime
    features/auth/AdminGate.tsx         # login / onboarding / no-access
    features/catalog/CatalogPage.tsx
    features/catalog/CatalogDialogs.tsx
    features/orders/OrdersPage.tsx      # fixtures + fake refunds/stats
    features/orders/order.utils.ts
    features/tables/TablesPage.tsx
    features/tables/TableDialog.tsx
    features/tables/tableQr.utils.ts
    features/users/UsersPage.tsx
    features/users/UserDialog.tsx
    hooks/useAdminToast.ts
    hooks/useAdminWorkspace.ts          # in-memory state — remove
  shared/
    auth/AuthContext.tsx
    data/{client,restaurants,menu,tables,orders}.ts
    lib/{supabase,database.types}.ts
    restaurant/RestaurantProvider.tsx
    ui/{Button,Icon,StatusPill}.tsx
  routes/AppRoutes.tsx
supabase/migrations/0001…0004
```

---

## 13. Style for the plan

Concrete, terse, no marketing language. Every claim should map to a file path, SQL object, or acceptance test. Prefer bullet lists over prose.
