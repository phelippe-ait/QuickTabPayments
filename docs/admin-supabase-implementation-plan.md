# QuickTab Admin — Supabase Integration Plan

> **For:** DeepSeek V4.1 Flash (implementation)
> **From:** planning pass over `docs/admin-supabase-plan-brief.md`, verified against the working tree on `feature/admin-app` (21 Oct 2026).
> **Baseline verified:** `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (18 tests / 7 files). All §7 audit findings were confirmed in code; extras are listed in §2.2. The bundle-size warning is pre-existing.

---

## 1. Clarifying questions

**None blocking.** Every fork in the brief has a safe default for a demo-this-week scope. The five decisions below are defaulted in this plan and repeated in §10 (Open decisions) for human confirmation. M1 and M3 depend on none of them — start there while D1–D5 are confirmed (timing detail in §10).

| # | Decision | Default in this plan |
| --- | --- | --- |
| D1 | Managers editing restaurant settings | Migration allows owner+manager updates; slug/owner_id/is_active stay owner-only (trigger-enforced) |
| D2 | `tables.seats` | Add nullable `seats int` column (1–12, null for Pick-up) |
| D3 | Staff invites | "Add existing profile by email" via `security definer` RPC; Edge Function deferred post-demo |
| D4 | Refund writes | Staff-writable `refunds` rows now (Stripe stubbed); policies tighten to service-role when Stripe lands |
| D5 | QR URL format | `{origin}/?r={slug}&t={qr_token}` |

---

## 2. Audit verification

### 2.1 Brief findings

All 28 findings (P0 #1–8, P1 #9–19, P2 #20–28) were confirmed at the cited paths. Two corrections/nuances:

- **#14 (table number normalisation):** `TableDialog.tsx:13` does `padStart(2, "0")`; the demo DB row is `T01`. `"T01".padStart(2,"0")` is a no-op, so the conflict is between the UI's zero-pad convention ("01") and the DB's existing "T01". Resolution in M4: stop normalising; `table_number` is free text, uniqueness is DB-enforced (`unique (restaurant_id, table_number)`), duplicates surface as a friendly error (already handled in `shared/data/tables.ts` via code `23505`).
- **#20 (dialogs):** `ConfirmDialog` already has `role="alertdialog"` + `aria-modal` but no focus trap/Escape. All other modals (`ItemModal`, `SectionsModal`, `TableModal`, `UserModal`, order detail, QR preview) have nothing.

### 2.2 Additional findings (not in the brief)

| # | Finding | Where | Milestone |
| --- | --- | --- | --- |
| A1 | `SUPABASE_NOT_CONFIGURED_MESSAGE` tells the user to copy `.env.example`, which does not exist | `src/shared/lib/supabase.ts:56` | M1 (add `.env.example`) |
| A2 | `fetchOrders` embeds `profiles(first_name,last_name,email)`; under self-only RLS this silently returns `null` for every other user — order customer names would render blank | `src/shared/data/orders.ts:23-29` | M5 (drop embed, use snapshot column) |
| A3 | `updateOrderStatus` sets `completed_at` for `cancelled` too — acceptable, but the semantic ("closed_at") must be documented so the customer/staff apps don't misread it | `src/shared/data/orders.ts:75-86` | M5 (doc comment + status module) |
| A4 | After routing lands (M1), kitchen-role users could deep-link `/admin/users` etc.; today's nav-hiding is not a guard | `AdminDashboard.tsx:38-41` | M1 (per-route role guard) |
| A5 | `ItemModal` defaults every new item to `/menu/matcha.jpg` — a fake image persists into `image_url` | `CatalogDialogs.tsx:8` | M3 (empty-state placeholder, no default) |
| A6 | Onboarding does two client writes with compensating delete; a `security definer` RPC makes it atomic | `src/shared/data/restaurants.ts:116-151` | M2 (`create_restaurant_with_owner` RPC) |
| A7 | "Delete user" in the current UI implies removing a person; with real data the safe operations are deactivate / remove-membership. Brief's must-have list only requires "role changes, deactivation" | `UsersPage.tsx`, `useAdminWorkspace.ts` | M7 (delete → remove membership, owner-only; bulk delete → bulk deactivate) |

---

## 3. Milestones

Ground rules for every milestone:

- Repo stays green: `npm run build`, `npm run lint`, `npm test` pass at each commit.
- `src/apps/customer/**` and `src/apps/staff/**` are never modified. `src/shared/**` changes are additive (the only apps consumer of `@shared/data` today is `AdminGate.tsx`; the one breaking change — `OrderWithDetails.profiles` → `customer_name_snapshot` in M5 — has no consumer outside admin).
- All migrations are idempotent (`if not exists`, `create or replace`, `drop policy if exists`), applied manually in the Supabase SQL editor in filename order after `0004`.
- After each migration, hand-update `src/shared/lib/database.types.ts` and note it in the commit body (CLI is not authenticated; see §11).
- Components never call Supabase directly: page → `useX` hook (TanStack Query) → `src/shared/data/*` function → client.
- Every mutation surfaces truthful toasts: success only in `onSuccess` after the server confirms; failure in `onError` with the server message (fixes #18 as each feature lands).
- Role gating: `kitchen` = read-only orders only; `manager` = everything except owner-only actions flagged below; `owner` = everything.

### M1 — Routing foundation, shell, error boundary

**Goal / user-visible outcome.** Deep-linkable, refresh-stable admin sections; keyboard/AT-correct nav; a render error shows a recovery screen instead of a blank page. Data is still fixture-backed (fixtures die in M3–M8); this milestone is pure structure.

**Preconditions.** Commit 0 first: the current uncommitted foundation work (AdminGate, RestaurantProvider, `shared/data/*`, `database.types.ts`, `main.tsx`) is committed as-is on `feature/admin-app` so every later milestone has a clean revert point — today a bad edit could destroy unversioned work (see §4, commit 1).

**Files.**

- Modify: `src/routes/AppRoutes.tsx` — `/admin` becomes a layout route with children:
  ```
  /admin            → index: Navigate to /admin/catalog (kitchen → /admin/orders)
  /admin/catalog    /admin/tables    /admin/users
  /admin/orders     /admin/orders/:id  (detail route added in M5; M1 registers a placeholder that renders "coming in M5" — or defer the :id child to M5; pick one and keep the nav stable)
  /admin/settings   (M1 renders a stub page; wired in M2)
  ```
- Modify: `src/apps/admin/AdminDashboard.tsx` — becomes the layout: `RestaurantProvider` + `RequireStaff` + `AdminShell` + `<Outlet/>`; keeps the toast host. All modal state and `useAdminWorkspace` move down into the section pages (each page owns its dialogs per brief §9.1).
- Modify: `src/apps/admin/components/layout/AdminShell.tsx` — nav items become `NavLink`s; add `aria-current="page"` on active (fixes #23), `aria-expanded` + `aria-controls` on the mobile menu button; Settings nav entry (owner/manager only).
- Add: `src/apps/admin/components/AdminModal.tsx` — shared dialog primitive: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap (focus first focusable on open, Tab cycling, restore focus to opener on close), Escape closes, backdrop `onMouseDown` close. Rebuild `ConfirmDialog` on top of it.
- Add: `src/apps/admin/components/RequireRole.tsx` — `{ roles: StaffRole[], children }`; renders a "Not available for your role" state (with sign-out/link back) when `useRestaurant().role` is not allowed (fixes A4). Gates: catalog/tables/users/settings → `["owner","manager"]`; orders → any staff.
- Add: `src/apps/admin/components/AdminErrorBoundary.tsx` — class boundary around the admin layout route (fixes #27); fallback: message + "Reload" button.
- Add: `.env.example` — `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=` (fixes A1).
- Add: `src/apps/admin/flags.ts` — feature-flag constants (`REFUNDS_ENABLED = false` until M6 flips it). Created here so the pattern predates any flaggable feature.
- Modify: `src/apps/admin/features/catalog/CatalogPage.tsx`, `features/tables/TablesPage.tsx`, `features/users/UsersPage.tsx`, `features/orders/OrdersPage.tsx` — each absorbs its dialog state from `AdminDashboard`; dialogs rebuilt on `AdminModal` (starts fixing #20).
- Modify: `src/apps/admin/App.test.tsx` — wrap renders in `MemoryRouter`; add route-guard tests.
- Delete: nothing yet (`useAdminWorkspace`/`fixtures` remain until their page is converted; after M1 they are imported only by pages that still use them).

**Data layer.** None. Query keys: none.

**DB changes.** None.

**UI / role gating.** As above. Kitchen sees only Order history nav + is route-guarded elsewhere.

**Cross-app impact.** None (`AppRoutes.tsx` change is additive: customer `/` and staff `/staff` untouched).

**Acceptance criteria.**

- [ ] `/admin/orders` deep link survives hard refresh and lands on Orders.
- [ ] `/admin` redirects to `/admin/catalog` (owner/manager) or `/admin/orders` (kitchen).
- [ ] Kitchen navigating to `/admin/users` sees the role-blocked state, not the page.
- [ ] Active nav link exposes `aria-current="page"`; mobile toggle exposes `aria-expanded`.
- [ ] Escape closes every dialog; focus returns to the opener; a thrown render error shows the boundary fallback.
- [ ] `App.test.tsx` gate tests still pass; new tests cover redirect + kitchen guard.
- [ ] Repo green.

**Tests.** Unit: `RequireRole` (allowed/blocked), `AdminModal` (Escape, focus restore). Integration: gate tests updated for router. Manual QA: refresh each deep link; tab through a dialog.

**Demo step unlocked.** Clean URLs during the demo; nothing user-facing changes yet.

**Risks / rollback.** Router restructure touches the gate tests. Rollback: revert the commit chain; no DB state.

---

### M2 — Settings page + Storage + restaurant-domain migrations

**Goal / user-visible outcome.** `/admin/settings`: edit restaurant profile (name, description, address, phone, email, currency, timezone, tax rate), upload logo and cover; everything persists across refresh. Managers can edit (except owner-only fields). Onboarding becomes one atomic RPC.

**Preconditions.** M1 (settings route stub exists).

**DB changes.**

- `supabase/migrations/0005_storage.sql` (fixes #7):
  - Buckets (idempotent insert into `storage.buckets`, `on conflict (id) do nothing`): `restaurant-assets` (public, `file_size_limit = 5242880`, `allowed_mime_types = {'image/jpeg','image/png','image/webp'}`) and `menu-items` (same limits; bucket created now, policies used by M3).
  - `storage.objects` policies:
    - Public read is served by the public bucket flag; still add `select` policy `using (bucket_id in ('restaurant-assets','menu-items'))` for API listing consistency.
    - Insert/update/delete for `authenticated`:
      ```
      with check (
        bucket_id = 'restaurant-assets'
        and (storage.foldername(name))[1] = <restaurant_id segment>
        and public.is_staff_of(((storage.foldername(name))[1])::uuid)
      )
      ```
      and the analogous policy for `menu-items`. Both buckets gate on folder-1 = restaurant UUID.
- `supabase/migrations/0006_restaurants_manager_update.sql` (fixes #8, D1):
  - Add `public.is_manager_of(p_restaurant_id uuid)` — `security definer`, true if `is_owner_of` or an active `restaurant_staff` row with role in (`owner`,`manager`).
  - Drop policy `restaurants_owner_update`; create `restaurants_staff_update` using/with check `is_manager_of(id)`.
  - Trigger `guard_restaurants_owner_fields` (before update): non-owners may not change `owner_id`, `slug`, or `is_active` → raise `42501`.
- `supabase/migrations/0007_onboarding_rpc.sql` (A6):
  - `public.create_restaurant_with_owner(p_name text, p_slug text)` returns `restaurants` row — `security definer`, inserts restaurant (`owner_id = auth.uid()`) + owner `restaurant_staff` row in one function; unique-violation on slug re-raised with a friendly message. Revoke from `public`, grant to `authenticated`.
- Update `src/shared/lib/database.types.ts` by hand: add `is_manager_of`, `create_restaurant_with_owner` to `Functions`. (Storage schema is not typed by hand; the upload helper uses string paths.)

**Files.**

- Add: `src/shared/lib/storage.ts` —
  ```ts
  export const IMAGE_LIMITS = { maxBytes: 5*1024*1024, mimeTypes: ["image/jpeg","image/png","image/webp"] } as const
  export function validateImageFile(file: File): void            // throws Error with user-facing message
  export function uploadRestaurantAsset(restaurantId: string, kind: "logo"|"cover", file: File): Promise<string>  // returns public URL
  export function uploadMenuItemImage(restaurantId: string, itemId: string, file: File): Promise<string>          // used in M3
  ```
  Paths per contract (§9.4): `restaurant-assets/{restaurant_id}/logo.{ext}`, `restaurant-assets/{restaurant_id}/cover.{ext}`, `menu-items/{restaurant_id}/{item_id}.{ext}`; `ext` derived from MIME (`jpg|png|webp`); upload with `upsert: true`; public URL via `getPublicUrl`.
- Modify: `src/shared/data/restaurants.ts` — add
  ```ts
  export async function createRestaurant(input: { name: string; slug: string }): Promise<Restaurant>  // calls rpc create_restaurant_with_owner
  ```
  Keep `createRestaurantWithOwner` exported (backward compatible) but switch `AdminGate.tsx` to `createRestaurant`.
- Add: `src/apps/admin/hooks/useRestaurantSettings.ts` —
  ```ts
  useRestaurantSettings(restaurantId): {
    restaurant, isPending, error,
    save(patch: TablesUpdate<"restaurants">): void,          // mutation → updateRestaurant
    uploadBranding(kind: "logo"|"cover", file: File): void,  // upload + save({logo_url|cover_image_url})
  }
  ```
  Query key `restaurantKeys.detail(restaurantId)`; mutations invalidate the same key + `restaurantKeys.membership(*)` (shell shows the name).
- Add: `src/apps/admin/features/settings/SettingsPage.tsx` (+ `SettingsBranding.tsx` if useful) — form for all editable fields; tax rate input as percent (0–100) mapped to fraction (0–1); currency select (AUD default; free-text fallback fine); owner-only fields (slug) rendered read-only for managers with a hint. Branding: current image preview, "Replace" file input (validation inline, no `window.alert`), optimistic disable while uploading.
- Add: `supabase/tests/rls_checks.sql` — runnable RLS verification script (simulate a user via `set_config('request.jwt.claims', ...)` + `set role authenticated`), one section per migration; extended by every later DB milestone (see §8 step 4).
- Modify: `src/apps/admin/features/auth/AdminGate.tsx` — use `createRestaurant` RPC (A6).
- Modify: `src/apps/admin/components/layout/AdminShell.tsx` — Settings nav entry live.

**UI / role gating.** Settings route: owner+manager (RequireRole from M1). Kitchen never sees it.

**Cross-app impact.** Shared additions only. Customer app later reads `logo_url`/`cover_image_url` (appendix).

**Acceptance criteria.**

- [ ] Edit name/description/address/phone/email/currency/timezone/tax rate → persists after hard refresh.
- [ ] Logo + cover upload → objects exist in `restaurant-assets/{id}/`, `logo_url`/`cover_image_url` hold the public URLs, sidebar/preview show them after refresh.
- [ ] >5 MB or non-image file → inline error, nothing uploaded (no `window.alert`).
- [ ] Manager account can save profile fields; slug change attempt is blocked in UI and, if forced via console, by the trigger (42501 → error toast).
- [ ] New-user onboarding creates restaurant + owner membership via one RPC call; duplicate slug shows the friendly error.
- [ ] SQL-editor RLS checks (§11) pass: manager update allowed on `name`, denied on `slug`; anon insert to `storage.objects` denied; staff upload to their restaurant folder allowed, to another restaurant's folder denied.

**Tests.** Unit: `validateImageFile`, tax-rate mapping, `uploadRestaurantAsset` path building (mock supabase client). Integration: SettingsPage save/error toast with mocked data layer. RLS: manual SQL script (below). Manual QA: full settings pass with the demo owner + a manager account.

**Demo step unlocked.** "Edit the restaurant profile and branding live; refresh — it stuck."

**Risks / rollback.** Storage policies are fiddly; if folder-based checks misfire, fallback is bucket-private + signed URLs (rejected for demo simplicity). Rollback: `drop policy` statements for each new policy, drop the two new functions, drop the trigger; delete buckets via dashboard. Migrations are additive — no data loss.

---

### M3 — Catalog on Supabase (categories + items + images)

**Goal / user-visible outcome.** Catalog reads/writes `menu_categories` + `menu_items`; images upload to Storage; sections are IDs (rename can't orphan items); deleting a category with items is blocked with a "move items first" flow; availability and bulk actions persist.

**Preconditions.** M2 (menu-items bucket + `uploadMenuItemImage`).

**DB changes.** None (schema already sufficient).

**Files.**

- Add: `src/apps/admin/mappers.ts` — DB row → view model converters (kept free of React):
  ```ts
  toMenuItemVM(row: DbMenuItem, categories: DbCategory[]): MenuItemVM
  toCategoryVM(row: DbCategory): CategoryVM
  ```
- Modify: `src/apps/admin/types.ts` — replace `MenuItem` with UUID-based VM (keep old export until M8 deletes the file):
  ```ts
  type MenuItemVM = { id: string; name: string; categoryId: string; categoryName: string;
    description: string; price: number; imageUrl: string | null; isAvailable: boolean; displayOrder: number }
  type CategoryVM = { id: string; name: string; displayOrder: number }
  ```
- Add: `src/apps/admin/hooks/useMenu.ts` —
  ```ts
  useMenu(restaurantId): {
    categories, items, isLoading, error, refetch,
    createItem(input), updateItem(id, patch), deleteItem(id), deleteItems(ids),
    setAvailability(ids, isAvailable),
    createCategory(name), renameCategory(id, name), deleteCategory(id),
    moveItemsToCategory(itemIds, categoryId), reorder(kind, orderedIds),
  }
  ```
  Query keys: `menuKeys.categories(restaurantId)`, `menuKeys.items(restaurantId)`. Mutations invalidate the matching key; errors surface verbatim (`deleteCategory` already maps FK `23503` to "This category still has menu items…", `deleteMenuItem` maps order-history FK to "mark unavailable instead").
- Modify: `src/shared/data/menu.ts` — add `updateMenuItems(ids, patch)` (bulk move/availability/reorder) and `updateCategories(orders: {id, display_order}[])` if needed for reorder; everything else exists.
- Modify: `src/apps/admin/features/catalog/CatalogPage.tsx` — consume `useMenu`; price display via `formatMoney(price, restaurant.currency)` (§9.3); image `alt={item.name}` (fixes #24); empty/loading/error states with retry.
- Modify: `src/apps/admin/features/catalog/CatalogDialogs.tsx` —
  - `ItemModal`: create flow generates `id = crypto.randomUUID()` client-side, uploads image first (if chosen) to `menu-items/{restaurantId}/{id}.{ext}`, then inserts the row with that id + `image_url` (fixes #10, #19). Edit flow: replace-image uploads to the same path scheme (upsert). Oversize/bad-type error renders inline (fixes #22). No default image (A5) — placeholder tile until an image exists. Section select lists categories by id (fixes #16 at the item level). Built on `AdminModal`.
  - `SectionsModal` → category manager over `CategoryVM[]`: rename = `updateCategory(id,{name})` (no cascade needed — items reference ids); delete = `deleteCategory(id)`, on FK error offer "Move its items to [select]" → `updateMenuItems(itemIds,{category_id})` then retry delete (fixes #9); add = `createCategory`; drag-free ordering via up/down buttons writing `display_order` (reorder).
- Delete (end of M3): `starterItems` import path from catalog; `useAdminWorkspace` item functions.

**UI / role gating.** Owner+manager. Kitchen blocked by M1 guard.

**Cross-app impact.** Additive shared changes only. Customer app later reads the same tables (appendix).

**Acceptance criteria.**

- [ ] Create/edit/delete item persists after hard refresh; delete of an item referenced by past orders shows the "mark unavailable" message (DB `23503`) as an error toast, not a fake success.
- [ ] Image upload creates a `menu-items/{restaurant}/{item}` object; `image_url` is the public URL; card shows it after refresh.
- [ ] Category rename does not touch items; category delete with items is blocked, and the move-then-delete flow works.
- [ ] Bulk availability and bulk delete persist; bulk delete reports per-error truthfully.
- [ ] `grep -R "starterItems" src/apps/admin` → no runtime hits.
- [ ] Repo green.

**Tests.** Unit: mappers, `ItemModal` validation (price ≥ 0, name required), category-delete flow logic. Integration: CatalogPage with mocked `useMenu` (loading/error/empty/rendered rows), mutation error toast. Manual QA: full CRUD + refresh; upload >5 MB; delete seeded item with order history.

**Demo step unlocked.** "Change the menu — price, photo, new section — refresh, it's real."

**Risks / rollback.** Upload-before-insert can orphan a Storage object if the insert fails (accepted; cleanup is a later Storage lifecycle rule). Rollback: revert commits; no migrations in this milestone.

---

### M4 — Tables on Supabase + real QR

**Goal / user-visible outcome.** Tables CRUD persists; QR encodes the canonical slug+token URL; printable sheet uses the real restaurant name; occupancy is derived from open orders; seats are a real column; the manual "mark occupied" fake toggle is replaced by derived status + `is_active` enable/disable.

**Preconditions.** M1. Independent of M2/M3 (can run in parallel).

**DB changes.**

- `supabase/migrations/0008_tables_seats.sql` (fixes #14, D2):
  ```sql
  alter table public.tables add column if not exists seats int check (seats is null or (seats between 1 and 12));
  ```
  Backfill: leave null (Pick-up stays null; seeded tables get values in §7).
- Types: add `seats: number | null` to `tables` Row/Insert/Update in `database.types.ts`.

**Files.**

- Add: `src/shared/lib/qr.ts` (contract §9.1):
  ```ts
  export function buildTableQrUrl(opts: { origin?: string; slug: string; qrToken: string }): string
  // `${origin ?? window.location.origin}/?r=${encodeURIComponent(slug)}&t=${encodeURIComponent(qrToken)}`
  ```
- Modify: `src/apps/admin/features/tables/tableQr.utils.ts` — re-export `buildTableQrUrl` (or delete and update imports).
- Modify: `src/shared/data/tables.ts` — nothing needed for CRUD (exists); add `updateTables(orders)` only if reorder lands (tables have no display_order — skip).
- Modify: `src/shared/data/orders.ts` — add
  ```ts
  export async function fetchOpenOrdersByTable(restaurantId: string): Promise<Record<string /*tableId*/, { orderId: string; orderNumber: string; status: OrderStatus; createdAt: string }>>
  ```
  Selects `id, table_id, order_number, status, created_at` where `status in ('pending','confirmed','preparing','ready')`; reduces to latest per table. Query key: `orderKeys.openTables(restaurantId)` (add to `orderKeys`).
- Modify: `src/apps/admin/types.ts` — replace `CafeTable` with:
  ```ts
  type TableVM = { id: string; number: string; locationLabel: string | null; seats: number | null;
    isActive: boolean; qrToken: string; openOrder: { orderNumber: string; status: OrderStatus; startedAt: string } | null }
  ```
- Add: `src/apps/admin/hooks/useTables.ts` — combines `tableKeys.all` + `orderKeys.openTables`; mutations create/update/delete/`setActive(ids, isActive)`; duplicate number → friendly `23505` message (already in data layer). Create supplies no `qr_token` (DB default `encode(gen_random_bytes(8),'hex')`).
- Modify: `src/apps/admin/features/tables/TablesPage.tsx` —
  - Card state: `Enabled/Disabled` (from `is_active`, actionable) + `Occupied/Free` badge (derived, read-only, links to the open order once M5 lands). Overview counters: total / enabled / occupied (derived).
  - "Seated X min ago" derived from `openOrder.startedAt` (real timestamps, fixes the "Just now" fake).
  - QR preview + download use `buildTableQrUrl(slug, qrToken)` (fixes #4).
  - Printable sheet: `<h1>{restaurant.name}</h1>`, filename `{slug}-table-qr-codes.html` (fixes #17).
  - Bulk actions: Enable/Disable + Delete (persist).
- Modify: `src/apps/admin/features/tables/TableDialog.tsx` — fields: number (free text, no padStart), location label (text input, not a 3-value enum — DB `location_label` is free text; keep quick-pick chips Indoors/Outdoors/Pick-up as suggestions), seats (number 1–12, hidden/disabled for Pick-up label), enable switch. No availability toggle (derived). No `Date.now()` id — insert without id (fixes #19). Built on `AdminModal`.
- Modify: `src/apps/admin/features/users/UsersPage.tsx` — copy fix "Café Shop" → restaurant name (fixes #17 partially; the rest of Users is M7).

**UI / role gating.** Owner+manager.

**Cross-app impact.** QR URL contract becomes canonical (§9.1); customer app must resolve `?r`/`?t` later (appendix). `fetchOpenOrdersByTable` is reusable by the staff app.

**Acceptance criteria.**

- [ ] Create/edit/delete/enable/disable tables persists after hard refresh; duplicate number shows the friendly error toast.
- [ ] QR (card, preview, PNG download, printable sheet) encodes `{origin}/?r={slug}&t={qr_token}` with the row's real 16-hex token; sheet header shows the real restaurant name.
- [ ] A table with an open order shows Occupied + order number + real elapsed time; completing/cancelling that order (M5, or via SQL) flips it to Free on refetch.
- [ ] Seats persist; Pick-up has no seats.
- [ ] `grep -R "starterTables" src/apps/admin` → no runtime hits. Repo green.

**Tests.** Unit: `buildTableQrUrl` (encoding, origin override), `fetchOpenOrdersByTable` reducer (latest-per-table), seats validation. Integration: TablesPage with mocked hooks; TableDialog duplicate error. RLS SQL check: staff write allowed, anon write denied. Manual QA: create table → scan QR with a phone (URL visible even though the customer app doesn't resolve it yet) → refresh.

**Demo step unlocked.** "Add a table, print its QR, scan it — the link carries the real token."

**Risks / rollback.** Migration is one nullable column — `alter table public.tables drop column seats` rolls back. Derived occupancy needs M5 data to be interesting; until then tables simply show Free.

---

### M5 — Orders on Supabase: list, detail, status, stats + seed data

**Goal / user-visible outcome.** `/admin/orders` and `/admin/orders/:id` render real orders with line items, payments, pagination, working filters; status transitions and cancellation persist and follow the transition matrix; the three stats cards are computed from the DB; CSV export runs on real data. Seed script populates a realistic café.

**Preconditions.** M1 (routes), M4 (open-order badge links here, soft dependency).

**DB changes.**

- `supabase/migrations/0009_orders_snapshot_and_stats.sql`:
  - `alter table public.orders add column if not exists customer_name_snapshot text;` (fixes blocker §4.4-6 / A2; customer app fills it later; null → display "Guest").
  - `create or replace function public.restaurant_daily_stats(p_restaurant_id uuid, p_timezone text default 'UTC') returns table (period text, orders_count bigint, revenue numeric, avg_order_value numeric)` — `language sql stable security invoker` (RLS applies: only staff can read their restaurant's orders, so no definer needed). Two rows: `today`, `yesterday`, day-bounded via `date_trunc('day', now() at time zone p_timezone)`; aggregates exclude `cancelled`; revenue = `sum(total)`.
  - Index: none new (`idx_orders_restaurant_status_created` already covers list/filter queries).
- `supabase/seed.sql` (§7) — run manually after migrations.
- Types: add `customer_name_snapshot` to `orders`, `restaurant_daily_stats` to `Functions`.

**Files.**

- Add: `src/shared/orders/status.ts` (contract §9.2, fixes #11):
  ```ts
  export const ORDER_STATUSES = ["pending","confirmed","preparing","ready","completed","cancelled"] as const
  export const orderStatusLabels: Record<OrderStatus, string>   // "Pending" | "Confirmed" | "Preparing" | "Ready for pickup" | "Completed" | "Cancelled"
  export const orderStatusTones: Record<OrderStatus, StatusTone> // pending→neutral, confirmed→info, preparing→warning, ready→primary, completed→success, cancelled→danger
  export const OPEN_ORDER_STATUSES = ["pending","confirmed","preparing","ready"] as const
  export function canTransitionStatus(from: OrderStatus, to: OrderStatus): boolean
  // pending→confirmed|cancelled; confirmed→preparing|cancelled; preparing→ready|cancelled; ready→completed|cancelled; completed/cancelled→(none)
  export function nextStatuses(from: OrderStatus): OrderStatus[]
  ```
  `completed_at` semantic: set when entering `completed` or `cancelled` ("closed at"); document in the module + `updateOrderStatus` (A3).
- Add: `src/shared/lib/money.ts` (contract §9.3):
  ```ts
  export function formatMoney(amount: number, currency: string, locale?: string): string  // Intl.NumberFormat; never parse formatted strings
  ```
- Modify: `src/shared/data/orders.ts` —
  - `orderSelect`: drop the `profiles(...)` embed (A2); add `customer_name_snapshot`; keep `order_items(*)`, `payments(*)`, `tables(table_number)`.
  - `fetchOrders(restaurantId, opts: { page?: number; pageSize?: number; status?: OrderStatus; from?: string; to?: string; search?: string })` → `{ rows: OrderWithDetails[]; count: number }` using `.select(orderSelect, { count: "exact" }).range(...)` (fixes #15). Filters: `status eq`, `created_at gte/lte` (day bounds in restaurant tz computed by caller), `or=(order_number.ilike.%s%,customer_name_snapshot.ilike.%s%)` for search.
  - Add `fetchOrderStats(restaurantId, timezone)` → rpc `restaurant_daily_stats`.
  - Keys: `orderKeys.list(restaurantId, filters)`, `orderKeys.stats(restaurantId)` added.
- Modify: `src/apps/admin/types.ts` — replace `Order`/`OrderLineItem` with VMs:
  ```ts
  type OrderLineVM = { id: string; name: string; quantity: number; unitPrice: number; subtotal: number; imageUrl: string | null; notes: string | null }
  type OrderVM = { id: string; orderNumber: string; status: OrderStatus; createdAt: string /* ISO */;
    total: number; subtotal: number; tax: number; currency: string; tableNumber: string | null;
    customerName: string; lineItems: OrderLineVM[]; payments: PaymentVM[]; refundedTotal: number }
  ```
- Add: `src/apps/admin/mappers.ts` (extends M3) — `toOrderVM(row, restaurant)`; dates formatted with `Intl.DateTimeFormat` in the restaurant timezone (fixes the display-string parser: `getOrderDate`/`formatRunningTime` in `order.utils.ts` are rewritten to take ISO strings — #11).
- Add: `src/apps/admin/hooks/useOrders.ts` —
  ```ts
  useOrders(restaurantId, filters): { orders, count, page, isLoading, error, setPage }
  useOrder(restaurantId, id): { order, isLoading, error }
  useOrderStats(restaurantId): { stats /* {today, yesterday} */, isLoading }
  useOrderMutations(restaurantId): { setStatus(id, status), cancel(id) }   // guards with canTransitionStatus; invalidates list+detail+openTables+stats
  ```
- Polling (cheap realtime substitute): `refetchInterval: 30_000` on the `useOrders`, `useOrderStats`, and `orderKeys.openTables` queries — the demo feels live without a realtime channel; §9.5 remains the upgrade path.
- Rewrite: `src/apps/admin/features/orders/OrdersPage.tsx` —
  - Stats cards from `useOrderStats`: today's orders (+Δ vs yesterday), today's revenue (+Δ), average order (fixes #13). All money via `formatMoney`.
  - Filters: status pills from `orderStatusLabels` (+ "All", + "Refunded" → client filter on `refundedTotal > 0` until refunds land in M6, then server `refunds` exists-join is optional), date range, search (order # / customer) — server-side via `fetchOrders`; pagination controls (page size 25, `count` total).
  - Rows: **no `role="button"` wrapper** (fixes #21) — order number cell is a `<Link to={/admin/orders/${id}}>`; checkbox lives in its own cell (label click stops propagation naturally since it's not nested in a link); whole-row click removed.
  - CSV export: unchanged formula-injection guard (#28 — keep verbatim), now on real rows; "Export selected" kept.
  - Running-time: from `createdAt` ISO (fixes #11).
- Add: `src/apps/admin/features/orders/OrderDetailPage.tsx` — route `/admin/orders/:id`; line items (`order_items` snapshots: name, qty, unit price, subtotal, notes), payment rows (method, status, paid_at, receipt link), customer block (`customer_name_snapshot` ?? "Guest"), status timeline + action buttons from `nextStatuses(status)` gated to owner/manager (kitchen read-only), Cancel with confirm. Detail modal styles reused; page built on `AdminModal` conventions for any confirms.
- Modify: `src/apps/admin/features/orders/order.utils.ts` — ISO-based `formatRunningTime(createdAt: string, now: number)`; delete `getOrderDate` string parser; `getRefundStatus(refundedTotal, total)` numeric only (fixes #12 partially; completes in M6).
- Delete: `starterOrders` usage (fixtures file itself dies in M8).

**UI / role gating.** All staff see orders (kitchen read-only: no transition/cancel/refund buttons). Owner/manager: transitions + cancel.

**Cross-app impact.** `shared/orders/status.ts` + `money.ts` are the reuse points for staff/customer (contract). `OrderWithDetails` shape changed (profiles embed dropped) — no external consumers.

**Acceptance criteria.**

- [ ] Orders list shows seeded DB orders with real line-item counts, totals, tables, customer snapshot/Guest; hard refresh identical.
- [ ] Pagination: >25 orders pages correctly; `count` matches SQL `select count(*)`.
- [ ] Filters (status/date/search) round-trip to the server; reset clears.
- [ ] `/admin/orders/:id` deep link works and survives refresh; shows line items + payment rows from DB.
- [ ] Status buttons only offer legal transitions; advancing to `completed` sets `completed_at`; cancel sets `status='cancelled'` + `completed_at`; both persist; kitchen sees no buttons.
- [ ] Stats cards equal SQL-computed values for today/yesterday (spot-check in SQL editor).
- [ ] CSV export contains real rows; a line item named `=cmd` exports quoted with a leading apostrophe (guard intact).
- [ ] With a second window open, an order inserted via the SQL editor appears in the list within ~30 s without manual refresh (polling).
- [ ] `grep -R "starterOrders" src/apps/admin` → no runtime hits. Repo green.

**Tests.** Unit: status matrix (`canTransitionStatus` exhaustive pairs), `formatMoney`, ISO `formatRunningTime`, `toOrderVM`, filters→query-param mapping. Integration: OrdersPage (mocked hooks: loading/error/empty/pages/rows), OrderDetailPage transition buttons per status/role. RLS SQL: staff select allowed, other-restaurant staff denied, customer sees own only. Manual QA: walk an order pending→…→completed; cancel one; refresh.

**Demo step unlocked.** The core demo: live order flow, stats that match the data, deep links.

**Risks / rollback.** `count: "exact"` with embedded joins can be slow at scale — fine for demo; fallback `{ count: "planned" }`. Seed script is destructive if run against the wrong slug — it targets one restaurant id resolved from `slug = 'quicktab-demo-cafe'` and only inserts (no deletes) except its own re-run guard. Rollback: drop function + column; delete seeded rows by `restaurant_id`.

---

### M6 — Refunds: schema + UI (Stripe stubbed)

**Goal / user-visible outcome.** Owner/manager can issue full, per-line partial, or custom refunds on orders with a succeeded payment; refunds persist as rows; refund state (Refunded/Partial) is computed from the DB; Stripe is explicitly stubbed with an honest UI note and a feature flag.

**Preconditions.** M5.

**DB changes.**

- `supabase/migrations/0010_refunds.sql` (fixes #6, D4):
  ```sql
  do $$ begin create type refund_status as enum ('requested','succeeded','failed');
  exception when duplicate_object then null; end $$;

  create table if not exists public.refunds (
    id            uuid primary key default gen_random_uuid(),
    order_id      uuid not null references public.orders(id)   on delete restrict,
    payment_id    uuid not null references public.payments(id) on delete restrict,
    order_item_id uuid          references public.order_items(id) on delete restrict,  -- null = custom/full-amount refund
    quantity      int           check (quantity is null or quantity > 0),
    amount        numeric(10,2) not null check (amount > 0),
    reason        text,
    status        refund_status not null default 'succeeded',   -- stub records succeeded; Stripe webhook will own transitions later
    stripe_refund_id text unique,
    created_by    uuid references public.profiles(id),
    created_at    timestamptz not null default now()
  );
  create index if not exists idx_refunds_order   on public.refunds(order_id);
  create index if not exists idx_refunds_payment on public.refunds(payment_id);
  ```
  - Trigger `guard_refund_amount` (before insert): parent payment must have `status='succeeded'`; `coalesce(sum(existing.amount),0) + new.amount <= payment.amount` else raise.
  - Trigger `guard_refund_quantity`: when `order_item_id` set, `quantity <= order_items.quantity` and `sum(quantity)` per order_item across refunds `<= order_items.quantity`; `amount` must equal `unit_price_snapshot * quantity` for line refunds (server-computed truth, fixes #12 math).
  - RLS: `refunds_select_staff` (mirrors `payments_select_own_or_staff` exists-join on orders); `refunds_staff_insert` / `refunds_staff_update` gated `is_staff_of(o.restaurant_id)`; **no delete policy**. Comment in the migration: drop the insert/update policies when the Stripe webhook (service role) takes over.
- Types: add `refunds` table + `refund_status` enum.

**Files.**

- Add: `src/shared/data/refunds.ts` —
  ```ts
  export async function fetchRefundsForOrder(orderId: string): Promise<Refund[]>
  export async function createRefund(input: TablesInsert<"refunds">): Promise<Refund>  // maps 23505/check violations to friendly messages
  export const refundKeys = { byOrder: (orderId: string) => ["refunds", orderId] as const }
  ```
- Add: `src/apps/admin/hooks/useRefunds.ts` — `useRefunds(orderId)` (key `refundKeys.byOrder`) + `useCreateRefund(orderId)` (invalidates refunds, order detail, orders list, stats).
- Modify: `src/apps/admin/features/orders/OrderDetailPage.tsx` —
  - Refund actions render only when: flag `REFUNDS_ENABLED` (flip it in `src/apps/admin/flags.ts`, added in M1), viewer is owner/manager, a `payments` row has `status='succeeded'`, and refundable balance (`payment.amount − Σ succeeded refunds`) > 0, and order is not `cancelled`-without-payment. Allowed on completed **and** open orders with succeeded payment — but the confirm dialog warns when the order is still open ("Order is still active — refund anyway?").
  - Partial mode keys quantities by `order_item.id` (fixes #12 name collision); amounts computed from numeric `unit_price_snapshot * qty` server-side-checked; custom mode validates `0 < amount <= balance` numerically.
  - Honest stub copy: "Stripe refund not yet processed — this records the refund in QuickTab." Toast on success only after insert returns.
  - Refund history list (amount, line summary, reason, date) from `refunds` rows; "Refunded to date" = Σ.
- Modify: `OrdersPage.tsx` — "Refunded" filter now server-aware via `refundedTotal` computed in `toOrderVM` (extend `orderSelect` with `refunds(id, amount, status)` where status='succeeded'); refund pill from `getRefundStatus(refundedTotal, total)`.
- Modify: cancel flow (M5) — confirm dialog lists un-refunded succeeded payments with their amounts (cancellation does not auto-refund; interaction documented per §4.3).

**UI / role gating.** Owner/manager only; kitchen never sees refund actions.

**Cross-app impact.** `refunds` table is the shared contract for the future Stripe webhook (service role writes `status` transitions + `stripe_refund_id`).

**Acceptance criteria.**

- [ ] Full/partial/custom refund on a succeeded payment creates a `refunds` row; visible after hard refresh; order list pill shows Partial refund/Refunded correctly.
- [ ] Over-refund (amount > balance, or qty > line qty) is rejected by the DB trigger and surfaced as an error toast.
- [ ] Refund on an order whose payment is `pending`/`failed` is impossible (no buttons; trigger also rejects).
- [ ] Two refunds on duplicate-named line items stay independent (keyed by id).
- [ ] `REFUNDS_ENABLED=false` hides all refund UI; payment status remains read-only.
- [ ] RLS SQL: staff insert allowed; customer/other-restaurant denied; delete denied for everyone (no policy).

**Tests.** Unit: refundable-balance math, partial quantity caps, flag gating. Integration: refund flow on mocked detail (full/partial/custom/error). RLS + trigger SQL checks (over-refund raises). Manual QA: seed order with succeeded payment → partial refund 1 of 2 → refresh → full refund remainder → over-refund attempt blocked.

**Demo step unlocked.** "Refunds are real records with DB-enforced limits — Stripe call is stubbed and flagged."

**Risks / rollback.** Trigger math must match UI math exactly — both derive from `unit_price_snapshot`. Rollback: drop table/type/triggers/policies; UI hides via flag first, code revert second. **Scope valve (if the week slips):** this is the highest-effort milestone per demo-minute — cut to "schema + read-only refund history/pills" (migration 0010 lands, insert UI doesn't, flag stays false). Saves ~1 day and keeps the honest-data story; prefer this cut over dropping refunds entirely.

---

### M7 — Staff directory: real users, roles, deactivation, invite-by-email

**Goal / user-visible outcome.** Users page lists real `restaurant_staff` joined with profile names/emails (via RPC — profiles RLS stays self-only); owner/manager can change roles, activate/deactivate, and add an existing account by email. No fake "create account" form.

**Preconditions.** M2 (`is_manager_of`).

**DB changes.**

- `supabase/migrations/0011_staff_directory.sql` (fixes #5, #3, D3):
  - `public.list_staff_directory(p_restaurant_id uuid)` returns table `(staff_id uuid, user_id uuid, email text, first_name text, last_name text, role staff_role, is_active boolean, created_at timestamptz)` — `security definer`, `set search_path = public`, body selects `restaurant_staff ⋈ profiles` **only when** `is_staff_of(p_restaurant_id)`; else returns no rows. Revoke from public/anon, grant authenticated. (RPC chosen over widening `profiles` SELECT: least privilege, one controlled surface, testable.)
  - `public.add_staff_by_email(p_restaurant_id uuid, p_email text, p_role staff_role default 'manager') returns uuid` — `security definer`; requires `is_manager_of`; rejects `p_role='owner'`; looks up `profiles` by `lower(email) = lower(p_email)` (profiles.email is `text`, not citext); raises `P0002` "No account found for <email> — ask them to sign up to QuickTab first" when missing; inserts membership (`on conflict (restaurant_id,user_id) do update set role=excluded.role, is_active=true`); returns the membership id. **Amended by 0012:** the old `profiles.role` promotion was removed with the global roles layer.
  - Policy swap on `restaurant_staff`: drop `staff_owner_manage`; create `staff_manager_manage` (all, using/with check `is_manager_of(restaurant_id)`).
  - Trigger `guard_staff_owner_rows` (before update/delete on `restaurant_staff`): non-owners may not modify/delete rows whose current or new `role='owner'` → `42501`.
  - Index: existing `idx_staff_restaurant (restaurant_id) where is_active` covers the RPC; add non-partial `create index if not exists idx_staff_restaurant_all on public.restaurant_staff(restaurant_id);` so the directory (which includes inactive rows) is indexed.
- Types: add both functions to `Functions`.

**Files.**

- Modify: `src/shared/data/restaurants.ts` —
  ```ts
  export type StaffDirectoryEntry = { staff_id: string; user_id: string; email: string | null;
    first_name: string | null; last_name: string | null; role: StaffRole; is_active: boolean; created_at: string }
  export async function fetchStaffDirectory(restaurantId: string): Promise<StaffDirectoryEntry[]>  // rpc list_staff_directory
  export async function addStaffByEmail(restaurantId: string, email: string, role: StaffRole): Promise<string>  // rpc add_staff_by_email, maps P0002/42501 to friendly errors
  export async function updateStaffMembership(staffId: string, patch: TablesUpdate<"restaurant_staff">): Promise<void>
  ```
  Keep old `fetchStaff` (backward compatible) but the admin hook switches to the directory.
- Add: `src/apps/admin/hooks/useStaff.ts` —
  ```ts
  useStaff(restaurantId): { staff: StaffVM[], isLoading, error }
  useStaffMutations(restaurantId): { setRole(staffId, role), setActive(staffId, isActive),
    bulkSetActive(staffIds, isActive), remove(staffId), addByEmail(email, role) }
  // key restaurantKeys.staff(restaurantId); every mutation invalidates it
  ```
  `StaffVM = { staffId, userId, name, email, initials, role, isActive }` — name/initials via `getProfileName`/`getInitials` (shared helper already exists), fallback email prefix, final fallback "Team member".
- Modify: `src/apps/admin/types.ts` — replace `User` with `StaffVM` (role domain is now `owner|manager|kitchen` — the fake `Staff/Manager/Admin` strings die, fixes #3).
- Rewrite: `src/apps/admin/features/users/UsersPage.tsx` — real list; filters (status: Active/Inactive; role: Owner/Manager/Kitchen); search over name/email (client-side on the directory, fine at team size); bulk activate/deactivate (persist); remove-membership per row (owner-only — managers see it disabled with a tooltip; server also rejects via trigger/policy, error surfaces as toast); own row shows "You" and cannot be deactivated/removed (client guard + DB trigger rejects owner-row edits by non-owners anyway); page copy uses restaurant name (fixes #17).
- Rewrite: `src/apps/admin/features/users/UserDialog.tsx` — two modes:
  - **Edit:** role select (owner/manager/kitchen; owner role only changeable by owner; changing your own role blocked client-side) + active switch. No name/email editing (that's the person's profile — out of scope).
  - **Add:** email + role; helper text "They must sign up to QuickTab first"; friendly error when no account matches (from RPC `P0002`). No password fields, no auth-account creation from the client (impossible with the anon key — this is the honest MVP invite; Edge Function invite listed in §10/appendix).
  - No `Date.now()` id (fixes #19). Built on `AdminModal`.

**UI / role gating.** Route: owner+manager. Within it: role changes/deactivation → owner+manager; owner-row management and membership removal → owner-only.

**Cross-app impact.** `restaurant_staff.role` is the only authorization source. **Amended by 0012:** the unused global `profiles.role` + `roles` lookup were removed, so there is no account-level role to promote. Staff app will consume `fetchStaffDirectory` when wired (appendix).

**Acceptance criteria.**

- [ ] Users list shows real names/emails for all memberships (including inactive) — verified against SQL `select * from list_staff_directory(...)` output.
- [ ] Changing a role persists after refresh and the person's `useRestaurant().role` changes on their next login/refetch (kitchen demo account restricted live).
- [ ] Deactivate → the user's membership stops granting access (`is_staff_of` false → their admin gate shows no-access on next load); activate reverses.
- [ ] Add-by-email with an existing account creates the membership; with an unknown email shows the "ask them to sign up first" error; adding twice reactivates instead of failing.
- [ ] Manager cannot demote/remove the owner (button disabled; forced call → 42501 toast). Nobody can remove/deactivate themselves via the UI.
- [ ] `grep -R "starterUsers" src/apps/admin` → no runtime hits. Repo green.

**Tests.** Unit: `StaffVM` mapping/fallbacks, own-row guards, role option gating. Integration: UsersPage with mocked directory (roles, filters, bulk deactivate), dialog error mapping. RLS SQL: manager can read directory but not owner rows; non-staff caller of `list_staff_directory` gets 0 rows; `add_staff_by_email` rejects non-managers (42501) and unknown emails (P0002). Manual QA: two browsers — owner demotes manager to kitchen, manager's view narrows on refresh.

**Demo step unlocked.** "The team page is real: roles change access live."

**Risks / rollback.** `security definer` functions need `search_path` pinned (done) and least-privilege grants; test with anon (`select` denied). Rollback: drop functions/trigger/policies, restore `staff_owner_manage` policy verbatim from `0004`.

---

### M8 — De-fixture, QA sweep, tests, docs

**Goal / user-visible outcome.** Zero fixture references in admin runtime; consistent loading/error/empty states everywhere; accessibility pass complete; page/data-layer test coverage; README/docs updated; final demo rehearsal against seeded data.

**Preconditions.** M3–M7 (all pages converted).

**Files.**

- Delete: `src/apps/admin/data/fixtures.ts`, `src/apps/admin/hooks/useAdminWorkspace.ts`.
- Rewrite/Delete: `src/apps/admin/types.ts` — the old numeric-ID types are gone; move VMs into `src/apps/admin/viewModels.ts` (or per-feature `types.ts`) and delete the old file. `Confirmation` type stays (used by `ConfirmDialog`).
- Sweep every admin page for: loading skeletons (simple spinner rows consistent with `GateLoading`), error state with Retry (`refetch`), empty state (existing `EmptyState`), disabled-while-pending mutation buttons.
- Accessibility (fixes #20–24 remainder): audit all `AdminModal` usages (focus return, Escape), order-detail confirms, `aria-expanded`/`aria-controls` on any disclosure, `alt` text rules — meaningful images get names, decorative stay `alt=""` consistently, keyboard selection in tables/catalog grids (checkboxes are already real inputs; verify tab order), mobile layout spot-check at 360px.
- Modify: `src/apps/admin/features/orders/OrdersPage.tsx` — CSV export final check on real paginated data (exports current filter across pages via a `pageSize=∞`-style fetch capped at e.g. 1000; keep the injection guard).
- Add tests (target: every feature has at least one page-level integration test + mapper/util units):
  - `mappers.test.ts`, `status.test.ts` (exhaustive transition matrix), `money.test.ts`, `qr.test.ts`, `storage.test.ts` (paths/validation), `useMenu/useTables/useOrders/useStaff/useRefunds` hook tests with a mocked `@shared/data/*` (vi.mock), page tests: Catalog, Tables, Orders list/detail, Users, Settings (loading/error/empty/happy paths, role gating).
- Docs: update `src/shared/README.md` (new `data/`, `orders/`, `lib/` entries); add `docs/admin-demo-runbook.md` (§6 script + §11 manual steps + seed instructions).
- Final grep gate: `grep -R "fixtures\|starterOrders\|starterItems\|starterTables\|starterUsers" src/apps/admin` → only test files/none.

**DB changes.** None.

**Cross-app impact.** None.

**Acceptance criteria.**

- [ ] The brief's §1 acceptance checklist passes end-to-end (every box).
- [ ] Grep gate returns zero runtime hits.
- [ ] `npm run build`, `npm run lint`, `npm test` green; customer/staff apps byte-identical in behaviour (their tests untouched and passing).
- [ ] Full demo script (§6) runs against a freshly seeded DB in ≤10 min with zero console errors (bundle-size warning excepted).

**Risks / rollback.** Pure app-layer; revert commits.

---

## 4. Ordered commit sequence

Conventional messages matching repo style (`feat:`, `fix:`, `test:`, `chore:`, `docs:`). One PR/branch continues `feature/admin-app`; commit after each green state.

1. `feat(admin): auth gate, restaurant context, and typed Supabase data layer` (commit 0 — the existing uncommitted foundation, committed as-is before any new work)
2. `feat(admin): nested routing, role-guarded sections, error boundary` (M1)
3. `feat(admin): shared AdminModal primitive with focus trap and Escape` (M1)
4. `feat(admin): feature flags module; add .env.example` (M1)
5. `test(admin): route guard and dialog a11y coverage` (M1)
6. `feat(db): storage buckets, manager restaurant updates, onboarding rpc (0005-0007)` (M2 — SQL files + database.types.ts)
7. `test(db): add supabase/tests/rls_checks.sql verification script` (M2 — extended by each later DB milestone)
8. `feat(shared): storage upload helpers with size/mime validation` (M2)
9. `feat(admin): settings page with profile CRUD and branding uploads` (M2)
10. `feat(admin): catalog backed by menu_categories/menu_items` (M3)
11. `feat(admin): menu image uploads to storage; category manager by id` (M3)
12. `feat(db): tables.seats column (0008)` (M4)
13. `feat(shared): canonical table QR url builder (slug + qr_token)` (M4)
14. `feat(admin): tables backed by db with derived occupancy` (M4)
15. `feat(db): orders customer snapshot, daily stats rpc (0009) + seed.sql with teardown block` (M5)
16. `feat(shared): order status module and money formatter` (M5)
17. `feat(admin): orders list/detail on supabase with pagination, filters, real stats, 30s polling` (M5)
18. `fix(admin): order rows no longer nest interactive elements; ISO-based running time` (M5)
19. `feat(db): refunds table with amount guards and staff RLS (0010)` (M6)
20. `feat(admin): refund flows on order detail behind feature flag` (M6)
21. `feat(db): staff directory rpc, add-by-email rpc, manager staff policy (0011)` (M7)
22. `feat(admin): users page on real restaurant_staff directory` (M7)
23. `refactor(admin): remove fixtures and useAdminWorkspace; view models only` (M8)
24. `test(admin): page and data-layer coverage; a11y sweep` (M8)
25. `docs: demo runbook, shared README update, manual migration steps` (M8)

---

## 5. Definition of demo-ready

All of brief §1 acceptance, plus:

- [ ] Seeded DB (§7) loaded; demo auth user verified as active `restaurant_staff` (owner) of `quicktab-demo-cafe`, plus working manager + kitchen logins.
- [ ] Every screen: no spinner hangs, no silent failures — every mutation ends in a truthful toast.
- [ ] Hard refresh on `/admin/orders/:id`, `/admin/settings`, `/admin/catalog`, `/admin/tables`, `/admin/users` renders identical state.
- [ ] Kitchen login shows orders only; deep-linking elsewhere is blocked.
- [ ] QR scan from the printable sheet opens `{origin}/?r=quicktab-demo-cafe&t={token}` (customer resolution is future work — say so in the demo).
- [ ] Refund flag state matches the story being told ("recorded in QuickTab; Stripe payout pending integration").
- [ ] **Rehearsed on the deployed demo domain, not localhost** — the Google OAuth redirect is configured for the production site (commit `499c533`). If OAuth has not been rehearsed on that exact domain, demo with email/password login only.
- [ ] All three demo accounts (`owner@/manager@/kitchen@quicktab.demo`) email-confirmed and sign-in-verified at least one day ahead; shared demo password lives in the runbook, never in the repo.
- [ ] `supabase/tests/rls_checks.sql` runs clean after the final migration.
- [ ] `seed.sql` freshly run; its teardown block (§6) is known in case a re-seed is needed mid-rehearsal.
- [ ] Grep gate + build/lint/test green on the demo commit.

### 10-minute demo script

1. **(0:00–1:00)** Sign in as owner → onboarding note: show a signed-out user creating a restaurant is one atomic RPC (mention, don't perform). Land on Catalog — data is from Supabase; point at a seeded item.
2. **(1:00–2:30)** Catalog: edit a price, upload a new photo (Storage object created live), toggle availability, rename a section, try deleting a section with items → blocked → move items → delete. **Hard refresh** — everything persisted.
3. **(2:30–3:30)** Tables: add "T09" with seats; open QR preview → URL contains `?r=quicktab-demo-cafe&t=<16-hex>`; download printable sheet → real restaurant name. Refresh.
4. **(3:30–5:30)** Orders: stats cards (today vs yesterday, computed in Postgres); filter to an open order; open detail via deep link; walk status pending→confirmed→preparing→ready→completed (`completed_at` set); show tables page now Free. If time allows: an order inserted via the SQL editor appears in the list within 30 s (polling — no realtime needed).
5. **(5:30–7:00)** Refunds: on a completed order with succeeded payment, refund one line item (partial), then a custom amount; show over-refund rejection (DB trigger); refresh → refund history persists.
6. **(7:00–8:30)** Users: real directory with names/emails (RPC, profiles RLS untouched); demote manager → kitchen in a second browser/incognito → their admin narrows to orders read-only; add-by-email flow (show unknown-email error, then success).
7. **(8:30–9:30)** Settings: change description + tax rate, replace logo; refresh; mention manager-vs-owner field locking.
8. **(9:30–10:00)** Close: grep gate on fixtures, `npm test` output, roadmap (Stripe refunds, realtime, customer/staff wiring).

---

## 6. Seed-data plan

`supabase/seed.sql`, run manually in the SQL editor **after** migrations 0005–0011. Idempotent by design: resolves `@restaurant_id` from `slug='quicktab-demo-cafe'`, uses `on conflict do nothing` everywhere, keyed on natural uniques.

- **Auth users (manual prerequisite, dashboard → Auth → Add user, email confirm on):**
  - `owner@quicktab.demo` (may already exist as the demo user), `manager@quicktab.demo`, `kitchen@quicktab.demo` — shared demo password documented in the runbook, never in the repo.
  - Seed then inserts `restaurant_staff` rows by email lookup: manager → `manager`, kitchen → `kitchen` (owner row exists from onboarding). Names set via `profiles` update (first/last) so the directory shows "Maya Johnson" etc. (reuse brief fixture names for continuity: Maya Johnson manager, Theo Martin kitchen — but they must be the real demo accounts).
- **Categories (4):** Hot Beverages, Breakfast, Lunch, Pastries — `display_order` 0–30.
- **Menu items (12):** Flat White 4.70, Babyccino 2.50, Mocha 5.00, Cappuccino 4.50 (unavailable — demonstrates the toggle), Ceremonial Matcha 5.80, Avocado Toast 14.00, Bacon & Egg Roll 12.50, Granola Bowl 13.00, Toasted Focaccia 15.50 (Lunch), Croissant 4.20, Pain au Chocolat 4.80, Lemon Tart 6.50 (Pastries). `image_url` → `/menu/*.jpg` for the five existing public assets, null otherwise (exercises the placeholder state).
- **Tables (9):** keep existing `T01`; add `T02`–`T06` (Indoors, seats 2/4/2/4/6), `T07`–`T08` (Outdoors, 4/2), `Pick-up` (null seats, location_label 'Pick-up'). DB default generates `qr_token`s.
- **Orders (16, last 7 days, `order_number` '1001'–'1016'):**
  - 10 completed (varied line items 1–4, `payments.status='succeeded'`, method mix card/apple_pay/google_pay, `paid_at` + `completed_at` set), spread so today has 4–5 orders and yesterday 3–4 (stats card deltas are non-zero).
  - 3 open: one `pending` (T02), one `preparing` (T05), one `ready` (Pick-up) — drives derived occupancy on the tables page.
  - 1 `completed` with a full refund (refunds row, amount = total) — shows "Refunded" pill.
  - 1 `completed` with a partial line refund — shows "Partial refund".
  - 1 `cancelled` unpaid — shows cancellation + cancel-with-warning paths.
  - `customer_name_snapshot`: real-ish names for ~half, null for the rest (exercises "Guest" fallback). `subtotal/tax/total` consistent with `tax_rate=0.1` and line subtotals (tax = round(subtotal*0.1, 2)).
- **Payments:** one per order (except cancelled-unpaid → `failed` row with `failure_reason`), amounts equal order totals, `stripe_payment_intent_id` fake `pi_demo_*` unique values.
- **Refunds:** the two rows above, `created_by` = owner profile id, `status='succeeded'`, `stripe_refund_id` null (stub).

Seed order matters: categories → items → tables → orders → order_items → payments → refunds (FKs). Wrap in a single `do $$ ... $$` or use CTEs with `returning id` captured into temp tables for FK ids.

- **Teardown (shipped as a commented-out block at the top of `seed.sql`):** `delete from` scoped to `@restaurant_id`, in FK order — refunds → payments → order_item_modifiers → order_items → orders → qr_sessions → tables → menu_item_modifier_groups → menu_items → menu_categories → (optionally) seeded `restaurant_staff` rows. Makes a botched or stale seed recoverable in one paste; also the standard pre-rehearsal reset.

---

## 7. Audit resolution matrix

| # | Finding | Resolution | Milestone |
| --- | --- | --- | --- |
| 1 | Fixture-backed screens | Pages converted to Supabase hooks | M3 (catalog), M4 (tables), M5 (orders), M7 (users); files deleted M8 |
| 2 | Fake refund/cancel/stats | Real mutations + Postgres stats RPC | M5, M6 |
| 3 | Fake user roles; "Add user" can't create accounts | `restaurant_staff` role domain; add-by-email RPC; honest copy | M7 |
| 4 | QR encodes table number; sheet hardcodes "Café Shop" | `buildTableQrUrl(slug, qr_token)`; sheet uses `restaurant.name` | M4 |
| 5 | Staff names unreadable (profiles RLS) | `list_staff_directory` security-definer RPC + index; profiles RLS unchanged | M7 |
| 6 | No refunds schema | `refunds` table + guards + RLS | M6 |
| 7 | No Storage buckets/policies | `0005_storage.sql` (2 buckets, 5 MB, MIME limits, staff-gated writes) | M2 |
| 8 | Manager blocked from restaurant edits | `is_manager_of` + policy swap + owner-field trigger guard | M2 |
| 9 | Category delete silently moves items | FK `23503` surfaced; explicit move-then-delete flow | M3 |
| 10 | Base64 images in state | Storage upload → public URL in `image_url` | M3 |
| 11 | 3-vs-6 status mismatch; display-string date parser | `shared/orders/status.ts` matrix; ISO timestamps everywhere | M5 |
| 12 | Refund math parses "$", keys by name, allows on unpaid | Numeric snapshot math, `order_item_id` keys, DB triggers enforce succeeded-payment + caps | M6 |
| 13 | Hardcoded stats | `restaurant_daily_stats` RPC | M5 |
| 14 | Occupancy/is_active conflation; no seats; number normalisation | Derived occupancy; `is_active` = enabled; `seats` column; free-text number, DB uniqueness | M4 |
| 15 | No pagination; 100-row cap | `range()` + `count: "exact"`, page size 25 | M5 |
| 16 | Categories as strings; rename by name | Category ids/UUID FKs; rename is a single-row update | M3 |
| 17 | "Café Shop" copy | Replaced with `restaurant.name` in QR sheet, Users copy; workspace confirms deleted with the hook | M4, M7, M8 |
| 18 | Fake toasts; errors invisible | `useMutation` onSuccess/onError toasts on every mutation | M2–M7 (pattern), M8 (sweep) |
| 19 | `Date.now()` ids | Server `gen_random_uuid()` / client `crypto.randomUUID()` for upload-first flow | M3, M4, M7 |
| 20 | Dialogs lack role/aria/focus/Escape | `AdminModal` primitive; all dialogs rebuilt on it | M1 (primitive), M2–M7 (adoption) |
| 21 | Nested interactive order rows; Space scroll | Rows become `<Link>` cells; checkbox in own cell; no row-level role=button | M5 |
| 22 | `window.alert` on oversize image | Inline field error from `validateImageFile` | M3 |
| 23 | Missing `aria-expanded` / `aria-current` | NavLink + button attributes in shell | M1 |
| 24 | Inconsistent `alt` text | Rule: meaningful → item/name text, decorative → `alt=""`, applied in sweep | M3 (catalog), M8 (sweep) |
| 25 | Tests cover only the gate | Hook/page/util tests per milestone + M8 coverage pass | M1–M8 |
| 26 | Hand-maintained DB types drift | Stays hand-maintained (CLI unauthenticated); per-migration update step + regen command documented in file header and runbook | every DB milestone; **out of scope** to automate |
| 27 | No error boundary | `AdminErrorBoundary` on the admin layout route | M1 |
| 28 | CSV injection guard | Kept verbatim, rewired to real data | M5, M8 |
| A1 | `.env.example` missing | Added | M1 |
| A2 | Orders embed profiles → silent nulls | Embed dropped; `customer_name_snapshot` + "Guest" fallback | M5 |
| A3 | `completed_at` semantics undocumented | Documented in status module + data-layer comment | M5 |
| A4 | Deep-link role bypass | `RequireRole` per route | M1 |
| A5 | Fake default item image | Placeholder state instead | M3 |
| A6 | Two-write onboarding | `create_restaurant_with_owner` RPC | M2 |
| A7 | "Delete user" semantics | Remove-membership (owner-only) + bulk deactivate | M7 |

**Out of scope (with reason):** realtime order feed, dashboard overview page (stretch, cut order #1/#3 — stats live on Orders); Stripe intent/webhook work (brief); modifier UI (brief); multi-restaurant switching (brief); customer/staff rewiring (brief — see appendix); Playwright E2E (brief); automated type generation (CLI unauthenticated — documented manual step instead); "Admin" global-role management UI (the global `profiles.role` + `roles` layer was removed in 0012).

---

## 8. Manual environment steps (SQL editor; CLI not authenticated)

Per DB milestone, in order:

1. Supabase dashboard → SQL editor → paste the new migration file(s) verbatim → Run. Files: `0005_storage.sql`, `0006_restaurants_manager_update.sql`, `0007_onboarding_rpc.sql` (M2); `0008_tables_seats.sql` (M4); `0009_orders_snapshot_and_stats.sql` (M5); `0010_refunds.sql` (M6); `0011_staff_directory.sql` (M7).
2. Storage buckets: if the dashboard-managed `storage.buckets` insert in `0005` is blocked by dashboard permissions, create both buckets in Dashboard → Storage with: public = on, file size limit = 5 MB, allowed MIME = jpeg/png/webp. Policies from `0005` still need the SQL editor.
3. After each migration, hand-update `src/shared/lib/database.types.ts` (tables/columns/functions/enums listed per milestone) and note "hand-maintained" in the commit body. When the CLI is eventually authenticated: `npx supabase gen types typescript --project-id <ref> > src/shared/lib/database.types.ts`.
4. RLS verification — the snippets below live in the repo as **`supabase/tests/rls_checks.sql`** (added in M2, extended with a section per DB milestone: M4 seats, M5 stats, M6 refunds, M7 directory/invite). Run the section matching the milestone in the SQL editor after applying it (replace `<uuid>`s):
   ```sql
   -- simulate a staff member:
   select set_config('request.jwt.claims',
     json_build_object('sub','<staff-user-uuid>','role','authenticated')::text, true);
   set role authenticated;
   select * from public.list_staff_directory('<restaurant-uuid>');      -- M7: rows expected
   select * from public.restaurant_daily_stats('<restaurant-uuid>');    -- M5: 2 rows
   update public.restaurants set slug='hack' where id='<restaurant-uuid>'; -- M2: 42501 for manager
   insert into public.refunds (order_id, payment_id, amount) values (...); -- M6: over-amount → trigger error
   reset role;
   ```
5. Before the demo: dashboard → Auth confirms `owner@/manager@/kitchen@quicktab.demo` exist and are email-confirmed; `select * from restaurant_staff where restaurant_id = (select id from restaurants where slug='quicktab-demo-cafe');` shows all three active.
6. Never place a `service_role` key in client code or `VITE_*` env vars (brief §11 — unchanged).

---

## 9. Cross-app contract appendix

Exact strings/formats future consumers must honour. No customer/staff code changes now.

### 9.1 QR URL (canonical)

```
{origin}/?r={restaurant.slug}&t={table.qr_token}
example: https://quicktab.example/?r=quicktab-demo-cafe&t=9f3ab12c7d44e0a8
```

- Builder: `src/shared/lib/qr.ts → buildTableQrUrl({ origin?, slug, qrToken })` (unit-tested).
- `qr_token` = 16 lowercase hex chars, DB-generated (`encode(gen_random_bytes(8),'hex')`), unique globally.
- The old `?table={number}` format (current `tableQr.utils.ts`) is dead; printed sheets from before M4 are invalid.
- **Customer app TODO (later):** on load, read `?r`/`?t`, resolve restaurant by slug (`restaurants_public_read_active`) and table by token (`tables_public_read`), replace hardcoded `tableNumber = 3` in `src/apps/customer/data/menu.ts:89`.

### 9.2 Order status (single source: `src/shared/orders/status.ts`)

| Status | Label | Tone | Enters `completed_at` | Next (staff) |
| --- | --- | --- | --- | --- |
| pending | Pending | neutral | — | confirmed, cancelled |
| confirmed | Confirmed | info | — | preparing, cancelled |
| preparing | Preparing | warning | — | ready, cancelled |
| ready | Ready for pickup | primary | — | completed, cancelled |
| completed | Completed | success | yes | — (refunds separate) |
| cancelled | Cancelled | danger | yes | — |

- Open statuses (occupancy, kitchen queues): `pending|confirmed|preparing|ready`.
- Cancellation × refunds: cancelling never auto-refunds; the cancel confirm lists un-refunded succeeded payments; refunds are independent rows against `payments`.
- Customer-side rule (already in RLS `orders_update_own_pending`): customers may only cancel their own `pending` orders.
- `completed_at` semantic = "closed at" (set for completed **and** cancelled).

### 9.3 Money

- DB: `numeric(10,2)` → JS `number`. `restaurants.tax_rate` is a fraction 0–1.
- Format only via `formatMoney(amount, currency, locale?)` (`Intl.NumberFormat(locale, { style: "currency", currency })`, locale default = browser).
- **Never** parse a formatted string back to a number (the `"$12.40".replace("$","")` pattern is banned; M5/M6 remove the last instances).

### 9.4 Storage paths

```
restaurant-assets/{restaurant_id}/logo.{jpg|png|webp}
restaurant-assets/{restaurant_id}/cover.{jpg|png|webp}
menu-items/{restaurant_id}/{menu_item_id}.{jpg|png|webp}
```

- Buckets `restaurant-assets`, `menu-items`: public read; writes authenticated + `is_staff_of(folder[1]::uuid)`; 5 MB; jpeg/png/webp.
- Item images: client generates the item UUID (`crypto.randomUUID()`) before upload so the path is stable; uploads use `upsert: true`.
- `image_url` columns store the full public URL (`{project}/storage/v1/object/public/{bucket}/{path}`).

### 9.5 Realtime (stretch — naming reserved, not implemented)

- Interim substitute (M5): 30 s `refetchInterval` polling on the orders list, stats, and open-tables queries. Upgrade path: swap polling for a channel subscription — no data-layer signature changes needed.
- Channel: `orders:{restaurant_id}` on `postgres_changes` filter `{ event: '*', schema: 'public', table: 'orders', filter: 'restaurant_id=eq.{id}' }`.
- Tables already in the `supabase_realtime` publication (0004 §10).

### 9.6 Roles

- `restaurant_staff.role` (`owner|manager|kitchen`, enum `staff_role`) = per-restaurant authorization — the only thing admin gating reads.
- **Amended by 0012:** the unused global `profiles.role` column, `public.roles` lookup, and `enforce_role_change_permission` trigger were removed. There is no platform-level role system in the current schema.
- Do not reintroduce a global role without a separate auth brief; the restaurant membership is the single source of truth.

### 9.7 Order numbers

- `orders.order_number`: text, unique per restaurant (`uq_orders_number_per_restaurant`).
- Format: zero-padded 4-digit incrementing per restaurant, starting `1001`; display `#{order_number}`.
- Generator rule (future customer app / seeds): `select coalesce(max(order_number::int),1000)+1 from orders where restaurant_id=$1` inside the insert transaction; on unique violation `23505`, retry once. A `next_order_number()` RPC can formalise this when the customer app is wired. Admin never creates orders.

### 9.8 Changes the customer/staff apps will need later (no code now)

- **Customer:** resolve `?r`/`?t` (§9.1); drop `src/apps/customer/data/menu.ts` mocks for `shared/data` menu queries filtered by `is_available`; populate `orders.customer_name_snapshot` at checkout (from profile or a guest-name field); use `shared/orders/status.ts` labels; adopt `order_number` generation (§9.7); use `formatMoney`.
- **Staff:** replace `src/apps/staff/data/fixtures.ts` with `shared/data` hooks (orders by `OPEN_ORDER_STATUSES`, `fetchOpenOrdersByTable`, `fetchStaffDirectory`); kitchen queue uses the shared status transitions; realtime subscription per §9.5.
- **Both:** benefit from `refunds` read model and Storage-hosted menu images automatically (same tables/URLs).

---

## 10. Open decisions (human confirm)

Defaults are already baked into the plan; flagging changes **before** the owning milestone avoids rework. **Timing:** D1 and D4 are encoded in migrations (`0006`, `0010`) — confirm or override those before M2/M6 SQL is written; the rest can be decided while M1–M3 are in flight.

| # | Decision | Default | Alternative | Affects |
| --- | --- | --- | --- | --- |
| D1 | Manager rights on `restaurants` | Manager may edit profile/branding; slug, owner_id, is_active owner-only (trigger) | Keep owner-only (managers get read-only Settings) | M2 migration 0006 |
| D2 | Table seats | Add `tables.seats` (nullable int 1–12) | Remove seats from the UI entirely | M4 migration 0008 |
| D3 | Invites | Add-existing-account-by-email RPC; signup-first copy | Supabase Edge Function with `service_role` sending real invite emails (needs CLI/deploy infra — post-demo) | M7 migration 0011 |
| D4 | Refund writes | Staff-writable stub rows (`status='succeeded'`), DB triggers cap amounts; tighten to service-role when Stripe webhook lands | Service-role-only from day one (requires Edge Function for the demo — cuts refund UI to read-only) | M6 migration 0010 |
| D5 | QR URL | `{origin}/?r={slug}&t={qr_token}` (query params — no hosting rewrite rules needed) | Path format `{origin}/r/{slug}/t/{token}` (prettier; requires SPA catch-all on the host) | M4 `shared/lib/qr.ts` |
| D6 | Kitchen in admin | Read-only order history (no transitions/refunds — staff app owns kitchen workflow) | Let kitchen advance preparing→ready from admin | M5 gating |
| D7 | "Delete user" | **Amended after review:** remove membership by owner **or manager**; owner rows stay owner-only; bulk delete → bulk deactivate. Managers already change roles/deactivate, so removal is not an escalation. | Hard-delete for managers too | M7 |

---

*Plan ends. Implementation order: M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 (M3/M4 may run in parallel after M2). Every milestone leaves `npm run build && npm run lint && npm test` green and the customer/staff apps untouched.*
