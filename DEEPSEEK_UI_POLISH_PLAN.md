# QuickTab — DeepSeek UI Polish, Accessibility & Responsiveness Plan

**Audience:** DeepSeek 4.1 Flash (implementation model).

This is the **UI polish track**, split out of `DEEPSEEK_IMPLEMENTATION_PLAN.md` so the
critical-path plan (Stripe payments, `/staff` auth gate, CI, Playwright) stays lean. Nothing
here is on the payment critical path. It is a catalog of **safe, non-breaking** fixes plus an
**accessibility** and **responsiveness** pass across the customer, staff, and admin apps.

**Relationship to the main plan:**
- Independent of Phases A–E. Do it **after** the critical path merges, or **in parallel** by a
  second implementer. If parallel, coordinate on shared files (`AppRoutes.tsx`,
  `StaffShell.tsx`, `OrderDetailPage.tsx`, `status.ts`) to avoid merge conflicts.
- A few items reference things the critical path builds (real payment status from Phases B–C,
  the D3 label maps, the A3 staff gate/sign-out). Those items are noted inline; implement them
  once the referenced ticket has landed, or stub the label and wire it later.

---

## Ground rules (condensed — full list in the main plan §1)

1. **Gate before merge:** every change passes `npm run lint && npm run test && npm run build`.
2. **Code style:** `import type` for type-only imports (`verbatimModuleSyntax`); no `enum`/
   `namespace`/parameter properties (`erasableSyntaxOnly`); no unused locals/params; path aliases
   `@/*` and `@shared/*` work inside `src` only.
3. **Tests ship with behaviour changes.** Extract pure logic (e.g. `naturalSortTableNumber`,
   `mapPaymentStatusLabel`, `isValidTimezone`) and unit-test it. Visual-only CSS changes need no
   test but must not break existing ones.
4. **Surgical changes.** Follow surrounding code; don't redesign or introduce parallel
   abstractions. Don't break the guest funnel.
5. **References are `file:approx-line`** from the current tree — match on surrounding code, not
   the line number (code drifts).

**Suggested PR grouping:** PR-UI-1 customer (F1–F3), PR-UI-2 staff (F4–F5), PR-UI-3 admin
(F6–F7), PR-UI-4 cross-cutting (F8). Keep each green before opening the next.

---

## F1 — Customer: correctness & consistency (safe)

- **9px confirmation-fallback bug.** `OrderConfirmation.tsx` (~line 54) reuses
  `styles["empty-cart"]` inside `.confirmation`; legacy CSS `.confirmation section p { font-size:
  9px }` (`App.module.css` ~263) shrinks the "We couldn't find that order" message to 9px and adds
  stray borders. **Fix:** give the fallback its own class (e.g. `styles["confirmation-error"]`)
  with normal sizing, or scope the legacy rule so it no longer matches. Verify visually.
- **Raw enum in history pill.** `OrdersScreen.tsx` (~79) prints `order.status` ("ready").
  **Fix:** use `orderStatusLabels` from `src/shared/orders/status.ts` ("Ready for pickup"),
  matching confirmation/tracking.
- **`✓` text glyph.** `OrderConfirmation.tsx` (~86) uses a literal "✓". **Fix:** use
  `<Icon name="check" aria-hidden />` (icon exists in `src/shared/ui/Icon.tsx`).
- **GST label inconsistency.** Checkout shows "GST (included, 10%)" while confirmation/tracking
  show "GST (included)". **Fix:** standardise the label (include the % everywhere or nowhere) via
  a shared helper.
- **Two taglines.** Tracking: "QuickTab · scan, order, track"; QR error: "QuickTab · scan to
  order". **Fix:** pick one and reuse.
- **No pluralisation + hyphen.** `MenuScreen.tsx` (~348) "1 item(s) in your cart - Total:".
  **Fix:** proper pluralisation and an en dash.
- **Blank screen on sign-out from Orders.** `CustomerDashboard.tsx` (~219) — when `user` becomes
  null while `screen === "orders"`, the shell goes blank. **Fix:** an effect that resets `screen`
  to `"menu"` when `user` transitions to null.
- **`HeaderButton` missing `type="button"`.** `components/CustomerUi.tsx` (~16) — inside
  `EditNameDialog`'s `<form>` the close button defaults to submit. **Fix:** add `type="button"`.
- **Dead global classes.** `"cart-screen"` (`CartScreen.tsx` ~28), `"auth-screen"`
  (`AuthScreen.tsx` ~74), `"google-pay"` (`CheckoutScreen.tsx` ~191) are applied but undefined;
  the Google Pay button lacks brand styling that Apple Pay/Link have. **Fix:** remove the dead
  classes or add the missing CSS. (If the main plan's Phase C removes the fake buttons, the
  `google-pay` item is moot.)
- **Orphaned `GoogleLoginButton.tsx`.** Unused, hardcodes a production Vercel URL and uses
  `supabase!`. **Fix:** delete it (AuthScreen already implements Google sign-in), or promote it to
  the shared button and remove the hardcoded URL. Prefer deletion.
- **Dead CSS.** `App.module.css` has ~30 unused selectors (`.brand-card`, `.filter-button`,
  `.option-row`, `.payment-pill`, `.apple-mark/.google-mark/.link-mark`, `.status-timeline`,
  etc.). **Fix:** remove selectors with no TSX references (grep each before deleting).

## F2 — Customer: accessibility

- **Modal focus management.** `ProductModal.tsx` and `EditNameDialog.tsx` lack focus trap,
  Escape-to-close, backdrop-click-close, and focus restore. **Fix:** reuse the admin
  `AdminModal.tsx` primitive (it already implements trap + Escape + restore) or extract a shared
  `FocusTrap`. Apply to both customer modals and the staff drawers (F5).
- **`aria-live` on cart updates.** Cart dock count/total (`MenuScreen.tsx` ~343) and quantity
  steppers (`CartScreen.tsx` ~51, `ProductModal.tsx` ~55) give no non-visual feedback. **Fix:**
  add `aria-live="polite"` to the cart dock summary and an `sr-only` live region announcing
  quantity changes.
- **Ambiguous "Remove" buttons.** `CartScreen.tsx` (~59) — every line's Remove has the same
  accessible name. **Fix:** `aria-label={`Remove ${item.name}`}`.
- **Drawer semantics.** `MenuScreen.tsx` (~209) "Open menu" toggle has no `aria-expanded`; the
  mobile drawer `<aside>` has no `role="dialog"`/`aria-modal`. **Fix:** add both; move focus into
  the drawer on open.
- **Duplicate image announcement.** `ProductPhoto.tsx` wrapper `role="img" aria-label={name}` +
  the visible `<strong>{name}</strong>` announce the name twice. **Fix:** drop the wrapper
  `aria-label` (keep `alt=""` on the inner img) or set the wrapper `aria-hidden`.
- **Multiple `<h1>`.** `MenuScreen.tsx` (~315) renders one `<h1>` per category. **Fix:** make
  category headings `<h2>` under a single page `<h1>`.
- **Fake drawer links.** `MenuScreen.tsx` (~200) "Our menu / Find a café / Help & support" are
  non-interactive `<span>`s styled as links. **Fix:** remove them, or make them real
  buttons/links with handlers.
- **Small text + contrast.** 9–10px text (`.item-name small`, `.order-status-pill`,
  `.payment-hint`, `.technology-footer`, badge `text-[9px]`) and `--color-muted #969198` on cream
  (~2.5–3:1) fail WCAG AA. **Fix:** raise the smallest sizes to ≥11–12px and darken the muted
  token to reach ≥4.5:1 for body text. Keep changes token-level where possible.
- **Disabled-without-explanation.** Checkout pay buttons are silently disabled until a name is
  typed. **Fix:** add a hint tying the disabled state to the name field (a simple hint suffices;
  full inline validation is out of scope).

## F3 — Customer: responsiveness

- **Tap targets < 44px.** Quantity buttons 17px (`ProductModal`), 20px cart pills, ~13px
  "Remove", 34px icon buttons. **Fix:** increase interactive hit areas to ≥44px (use padding or a
  min-size wrapper) without changing visual density much.
- **`vh` vs `dvh`.** `.product-modal { max-height: calc(100vh - 28px) }` can push the footer
  under iOS Safari's dynamic toolbar. **Fix:** use `dvh` with a `vh` fallback.
- **Body scroll lock.** Background scrolls behind modals/drawer on touch. **Fix:** lock `body`
  scroll while a modal/drawer is open (toggle `overflow: hidden` + restore on close).
- **Hidden brand on mobile.** `.menu-brand { display:none }` (<768px) hides the restaurant name —
  the page context. **Fix:** show a compact brand on mobile.
- **Tracking poll on hidden tabs.** `OrderTrackingScreen` polls every 7s even in a background tab.
  **Fix:** pause on `document.visibilitychange` (resume on visible). Low risk, saves battery.

## F4 — Staff: honesty & polish (safe)

- **Fake "Service live" badge.** `StaffShell.tsx` (~61) is always green. **Fix:** tie it to the
  polling/realtime health (or make it neutral until a real connection signal exists). At minimum,
  don't show a green "live" dot when the last fetch errored.
- **Dead Settings button + decorative bell.** `StaffShell.tsx` (~49, ~62) have no handlers; the
  bell has a permanent red dot. **Fix:** wire Settings to sign-out (or remove), and remove the
  decorative bell/red-dot until notifications exist (out of scope).
- **Hardcoded branding/role/hours.** `StaffShell.tsx` "Café Shop" (~40, ~59), "Floor manager"
  (~52), "Dinner service · 5:00 PM – 11:00 PM" (~60). **Fix:** use the real restaurant name
  (`useRestaurant()`), the real role (`roleLabels[role]` from
  `src/shared/restaurant/restaurantHelpers.ts`), and drop the fake service-hours line (or derive
  it). The `restaurantName` prop is already declared but unused — wire it.
- **Missing sign-out.** The staff shell has no sign-out. **Fix:** add one (mirrors admin), now
  that the main plan's A3 gates the route.
- **Fake order metadata.** `staffOrders.ts` (~84, ~100) hardcodes guest "Customer", server
  "QuickTab", guests 1, payment "Not confirmed"; `orderHistory.ts` (~61) hardcodes payment "Paid"
  and (~47) table "Pickup". **Fix:** use real data — `customer_name_snapshot`, the real
  `tables.table_number`, and the real payment status (available after the main plan's Phases B/C).
  Where a field genuinely doesn't exist, render "—" rather than a fabricated value.
- **Hardcoded 9% GST fallback.** `OrderHistory.tsx` (~105) `order.total / 1.09`. **Fix:** use the
  restaurant's real `tax_rate` (or the stored `tax`/`subtotal`).
- **Hardcoded `$`.** `OrderHistory.tsx` (~77, ~179) and `TablesWorkspace.tsx` (~51). **Fix:** use
  `formatMoney(amount, restaurant.currency)`.
- **Cancelled history pill tone.** `OrderHistory.tsx` (~138) shows cancelled as "primary"; the
  kitchen uses "danger". **Fix:** use `orderStatusTones` for consistency.
- **`.replace("Today, ", "")` no-op.** `KitchenWorkspace.tsx` (~82, ~182). **Fix:** remove the
  dead replace (kitchen times never carry that prefix).
- **Table editor overlay copy.** `TablesWorkspace.tsx` (~97) `aria-label="Close order details"` on
  a *table* editor. **Fix:** "Close table editor".
- **`seats` never fetched → "Capacity not set".** `staffTables.ts` (~21) omits `seats`. **Fix:**
  select `seats` and populate it; fix "Capacity ·  guests" / "Maximum " empty interpolations
  (`TablesWorkspace.tsx` ~117, ~167).
- **Lexicographic table sort.** `staffTables.ts` (~26) sorts text `table_number` (10 before 2).
  **Fix:** natural/numeric sort.
- **Tables view has no loading/error/empty state** (`TablesWorkspace.tsx` ~295; error swallowed at
  `useStaffWorkspace.ts` ~81). **Fix:** add all three (reuse the shared `Skeleton` and an
  `EmptyState`).
- **TablesWorkspace missing bottom spacer** for the fixed mobile nav (Kitchen/History/Reservations
  have one). **Fix:** add `pb-16 lg:pb-0` / an `h-16 lg:hidden` spacer.
- **Realtime channel leak (StrictMode).** `useStaffWorkspace.ts` (~194) cleanup races the async
  subscribe; the channel can leak. **Fix:** track a `cancelled` flag / remove the channel in
  cleanup deterministically (assign `removeSubscription` synchronously or guard with a ref).
- **`window.alert` + `console.log` noise.** `useStaffWorkspace.ts` (~280, ~283). **Fix:** replace
  `window.alert` with an inline error/toast; drop the success `console.log`.

## F5 — Staff: accessibility

- **Nav active state.** `StaffUi.tsx` `NavButton`/`MobileNav` (~16, ~43) and the filter pills
  convey active state by colour/dot only. **Fix:** add `aria-current="page"` (nav) /
  `aria-pressed` (filter toggles).
- **Drawers/dialogs lack focus management.** `TableEditor`, `HistoryOrderDrawer`,
  `KitchenStatusConfirmation`, (and the now-hidden reservation drawers). **Fix:** apply the shared
  focus-trap/Escape/restore primitive from F2.
- **`aria-live` on the auto-refreshing board.** `KitchenWorkspace.tsx` mutates silently on the 5s
  poll. **Fix:** add a polite `aria-live` region announcing new/changed orders (throttled).
- **Table status toggle `aria-pressed`.** `TablesWorkspace.tsx` (~129). **Fix:** add it.

## F6 — Admin: safe fixes

- **No skeleton loaders.** Every admin page uses centered text placeholders
  (`OrderDetailPage.tsx` ~85, `OrdersPage.tsx` ~208, `CatalogPage.tsx` ~82, `TablesPage.tsx` ~102,
  `UsersPage.tsx` ~115, `SettingsPage.tsx` ~105). **Fix:** use the shared `Skeleton`
  (`src/shared/ui/shadcn/skeleton.tsx`) for a consistent loading state. Also give the lazy-route
  Suspense fallback (`AppRoutes.tsx` ~48, currently an empty div) a real skeleton/spinner.
- **KPI cards render `0`/`$0.00` while loading.** `OrdersPage.tsx` (~127) ignores
  `statsQuery.isLoading`. **Fix:** show a skeleton until loaded.
- **Hardcoded `$` on custom-refund input.** `OrderDetailPage.tsx` (~418). **Fix:** use the
  restaurant currency symbol.
- **Raw enum in payment/refund pills.** `OrderDetailPage.tsx` (~319, ~362). **Fix:** label maps
  (covered by the main plan's D3 / F8 below).
- **Refund confirm copy.** "Record a partial refund?" / "custom" vs the "Other amount" button
  (`OrderDetailPage.tsx` ~168, ~382). **Fix:** consistent wording.
- **Section delete has no confirmation.** `CatalogDialogs.tsx` (~250) deletes a category without a
  `ConfirmDialog` (item deletes do confirm). **Fix:** add a confirmation.
- **QR sheet HTML injection.** `TablesPage.tsx` (~76) interpolates `restaurantName`/`locationLabel`
  into raw HTML unescaped. **Fix:** escape interpolated values.
- **Unguarded clipboard write.** `TablesPage.tsx` (~232) `navigator.clipboard.writeText` throws in
  insecure contexts. **Fix:** wrap in try/catch with a fallback + toast.
- **Filter pills missing `type="button"` + `aria-pressed`.** `CatalogPage.tsx` (~90),
  `OrdersPage.tsx` (~154), `TablesPage.tsx` (~113). **Fix:** add both. `PageHeader`'s action
  button (`AdminUi.tsx` ~59) also lacks `type="button"` and hardcodes a plus icon. **Fix.**
- **Select-all checkbox has no indeterminate state.** `OrdersPage.tsx` (~215). **Fix:** set
  `indeterminate` for partial selection.
- **Pagination flickers disabled during 30s polling.** `OrdersPage.tsx` (~274) disables on
  `isFetching`. **Fix:** disable only on the page-change mutation, not background refetch.
- **Toasts: single-slot, errors use `role="status"`, error/success look identical.**
  `useAdminToast.ts` (~7), `AdminUiProvider.tsx` (~51). **Fix:** use `role="alert"` for errors and
  a distinct error style.
- **Modals don't lock background scroll.** `AdminModal.tsx` (~112). **Fix:** lock body scroll while
  open (shared with F3).
- **Timezone free-text with no validation.** `SettingsPage.tsx` (~263) — an invalid IANA zone
  breaks every `Intl.DateTimeFormat` call app-wide. **Fix:** validate against
  `Intl.supportedValuesOf("timeZone")` (or a select) and reject invalid input.

## F7 — Admin: accessibility & responsiveness

- **Focus order + labels** on dialogs (mostly handled by `AdminModal`); verify each dialog's
  initial focus and `aria-labelledby`.
- **Tablet responsiveness.** Admin targets laptops/tablets. Verify the orders table and
  order-detail grid at ~768–1024px; add horizontal scroll or column stacking where cramped.
- **Kitchen-display density (staff).** `KitchenWorkspace.tsx` cards go 2-col only at `xl` (1280px);
  iPad-landscape (1024px) shows a single column. **Fix:** allow 2 columns at `lg` for the kitchen
  board (the real KDS device is a tablet in landscape).

## F8 — Cross-cutting consistency

- **Centralise status label/tone maps.** Customer history, staff board, and admin pills should all
  import `orderStatusLabels`/`orderStatusTones` from `src/shared/orders/status.ts`. Add analogous
  maps for `payment_status` and `refund_status` (new small module, e.g.
  `src/shared/orders/paymentLabels.ts`) and use them everywhere instead of raw enums. (Coordinate
  with the main plan's D3, which introduces the same maps for the admin order-detail page.)
- **Consistent loading idiom.** Pick one skeleton component and use it across customer/staff/admin
  (today there are three idioms: pulse divs, shadcn Skeleton, bare text).

---

**Tests:** add/adjust Vitest for every behaviour change (label maps, pluralisation, visibility
pause, validation). Pure-function tests are cheap — prefer extracting logic (e.g.
`naturalSortTableNumber`, `mapPaymentStatusLabel`, `isValidTimezone`) and unit-testing it.
Visual-only CSS changes need no test but must not break existing ones.

**Acceptance:** no raw enum strings visible to users; loading states are skeletons; modals trap
focus and close on Escape; tap targets ≥44px on customer; staff shell shows real restaurant/role
and no fake indicators; admin destructive actions all confirm; `npm run lint && npm run test &&
npm run build` pass.
