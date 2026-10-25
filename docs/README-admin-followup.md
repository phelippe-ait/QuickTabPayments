# README — Admin Supabase follow-up tasks

> **For:** DeepSeek V4.1 Flash.
> **Context:** the plan in `docs/admin-supabase-implementation-plan.md` was implemented and reviewed (branch `feature/admin-app`, 25 commits, tree clean). Review verdict: **pass** — build/lint/test green (110 tests), fixture grep gate clean, customer/staff apps untouched, migrations 0005–0011 applied to the linked Supabase project, seed loaded, live RLS probes correct.
> **This file contains the remaining work.** Do it in order. Ground rules unchanged: never modify `src/apps/customer/**` or `src/apps/staff/**`; repo green at every commit; conventional messages.

---

## 1. Hygiene fixes (do first, one commit each)

### 1.1 Untrack Supabase CLI state
`supabase/.temp/` was committed. It contains the project ref, `linked-project.json`, and a pooler connection string (no password, but CLI state must not be in git).

```bash
echo "supabase/.temp/" >> .gitignore
git rm -r --cached supabase/.temp
git commit -m "chore: untrack Supabase CLI temp state"
```

### 1.2 Untrack `skills-lock.json`
It is listed in `.gitignore` ("local agent/skill tooling") yet still tracked. Untrack it.

```bash
git rm --cached skills-lock.json
git commit -m "chore: untrack skills-lock.json (gitignored local tooling)"
```

### 1.3 Regenerate database types from the linked project
The project is now CLI-linked, so the hand-maintained-types assumption (audit #26) no longer holds — take it:

```bash
npx supabase gen types typescript --linked > /tmp/generated.types.ts
```

Then merge: replace the `Database` object in `src/shared/lib/database.types.ts` with the generated one, **but keep the hand-written tail** — the `type PublicSchema = ...` block and the shorthand exports (`Profile`, `Restaurant`, `Refund`, `RefundStatus`, `CafeTable`, …) that the data layer imports; `gen types` does not emit them. Update the file header comment to reflect generated-then-postfixed. If the CLI refuses (token expired), skip this task and say so in the commit log message of task 3.

Verify the diff shows no unexpected removals (e.g. `Enums.refund_status`, `Functions.list_staff_directory`, `tables.seats` must survive). Then:

```bash
npm run build && npm run lint && npm test
git commit -m "chore(db): regenerate database.types.ts from linked project"
```

---

## 2. Deviations — decisions are settled; implement exactly this

| # | Deviation | Decision | Action |
| --- | --- | --- | --- |
| 1 | Managers can remove non-owner staff members (plan D7 said owner-only) | **Accept — D7 is amended.** A manager can already change roles and deactivate; removing a membership is not an escalation. Owner rows remain protected by `guard_staff_owner_rows`; the UI/DB are consistent. | No code change. Update `docs/admin-supabase-implementation-plan.md` §10 D7 row to record the amendment, and mention the behavior in `docs/admin-demo-runbook.md`. |
| 2 | "Refunded" filter pill was dropped instead of becoming a client-side filter | **Accept the cut.** Refund state still shows as pills on rows and in detail. | No code change. One line in the runbook: filtering by refunded state across pages is post-demo. |
| 3 | Order detail renders "Running …" for **completed** orders (excludes only `cancelled`); the list page correctly gates on open statuses | **Fix.** | In `src/apps/admin/features/orders/OrderDetailPage.tsx`, change the running-time condition from `order.status !== "cancelled"` to `isOpenOrderStatus(order.status)` (`isOpenOrderStatus` is already imported). Add a regression test in `OrderDetailPage.test.tsx`: completed order → no "Running" text; pending order → "Running" present. |
| 4 | Commit 0 message is `feat: enhance authentication and data management` (plan specified a scoped message) | **Accept — do not rewrite history.** | Nothing. |

Task 3 commit message: `fix(admin): running time only shows for open order statuses`.

---

## 3. Live-data cleanup (SQL editor — no repo change)

The implementer's manual QA left a stray item in the demo restaurant:

```sql
delete from public.menu_items
where restaurant_id = (select id from public.restaurants where slug = 'quicktab-demo-cafe')
  and name = 'Classic Burger';
```

No Storage object exists for it (its `image_url` was null), so nothing to delete there. Do not touch existing `T01` (null seats is correct for it). Confirm afterwards:

```sql
select name from public.menu_items
where restaurant_id = (select id from public.restaurants where slug = 'quicktab-demo-cafe')
order by name;   -- expect exactly the 12 seeded items
```

---

## 4. Verify the plan was implemented properly (run everything, report failures instead of fixing silently)

### 4.1 Repo gates
```bash
npm run build && npm run lint && npm test
grep -RIn "fixtures\|starterOrders\|starterItems\|starterTables\|starterUsers" src/apps/admin   # expect: no hits
git diff 983ad27..HEAD --stat -- src/apps/customer src/apps/staff                                # expect: empty
```

### 4.2 Live API probes (anon; expect 200/200/200, two rows, 401)
```bash
source <(grep -E '^VITE_SUPABASE_(URL|ANON_KEY)=' .env.local | sed 's/^/export /')
curl -s -o /dev/null -w "refunds:%{http_code}\n"              "$VITE_SUPABASE_URL/rest/v1/refunds?select=id&limit=1"                            -H "apikey: $VITE_SUPABASE_ANON_KEY"
curl -s -o /dev/null -w "snapshot-col:%{http_code}\n"         "$VITE_SUPABASE_URL/rest/v1/orders?select=customer_name_snapshot&limit=1"          -H "apikey: $VITE_SUPABASE_ANON_KEY"
curl -s -o /dev/null -w "seats-col:%{http_code}\n"            "$VITE_SUPABASE_URL/rest/v1/tables?select=seats&limit=1"                          -H "apikey: $VITE_SUPABASE_ANON_KEY"
curl -s -X POST "$VITE_SUPABASE_URL/rest/v1/rpc/restaurant_daily_stats" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_restaurant_id":"00000000-0000-0000-0000-000000000000"}'   # expect: today + yesterday rows (zeros for anon)
curl -s -X POST "$VITE_SUPABASE_URL/rest/v1/rpc/list_staff_directory" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_restaurant_id":"00000000-0000-0000-0000-000000000000"}'   # expect: 401 / 42501 — anon denied
```

### 4.3 SQL-editor runs (human-assisted; paste from `supabase/tests/rls_checks.sql`)
- Every M2 check (a)–(g), M4 (h)–(i), M5 (j)–(l), M6 (m)–(o), M7 (p)–(s) with real UUIDs. All expected results are in the file comments.
- Re-run `supabase/seed.sql` once to prove idempotency (row counts must not change).
- Dashboard → Storage: both buckets exist, public, 5 MB, jpeg/png/webp.
- Dashboard → Auth: `owner@quicktab.demo`, `manager@quicktab.demo`, `kitchen@quicktab.demo` exist and are **email-confirmed** (demo blocker otherwise).

### 4.4 Manual QA (the plan's acceptance lists)
Walk the per-milestone acceptance criteria in `docs/admin-supabase-implementation-plan.md` §3 (boxes under each milestone) plus the §5 "Definition of demo-ready" checklist, hard-refreshing after every mutation. `REFUNDS_ENABLED` stays `true` — the refund UI shows honest "recorded in QuickTab, Stripe not called" copy; that's the demo story.

---

## 5. What's next (planning backlog — do not start without a new brief)

Priority order for the next phases:

1. **Stripe wiring** — payment-intent creation + webhook handler (Edge Function or server) writing `payments`, then real refunds: webhook owns `refunds.status` transitions and `stripe_refund_id`; **drop `refunds_staff_insert`/`refunds_staff_update` policies** (service role only — that was always the D4 end-state) and add `with check (created_by = auth.uid())` to whatever write policy remains. Flip a real `REFUNDS_STRIPE_LIVE` flag when done.
2. **Customer app on Supabase** — resolve `?r={slug}&t={qr_token}` (§9.1 of the plan), replace `src/apps/customer/data/menu.ts` mocks with `shared/data` menu queries, populate `orders.customer_name_snapshot` at checkout, implement the order-number generator contract (§9.7).
3. **Staff app on Supabase** — replace `src/apps/staff/data/fixtures.ts`; kitchen queue driven by `OPEN_ORDER_STATUSES` + shared status module; reuse `fetchOpenOrdersByTable`.
4. **Realtime** — channel naming reserved in §9.5; replace 30 s polling (`refetchInterval` in `useOrders`/`useTables`) with `postgres_changes` subscriptions.
5. **Stretch** — dashboard overview page, modifier-group UI, multi-restaurant switching (`fetchMemberships` already returns the list), CSV export across all pages.

Housekeeping for the same phase: a `package.json` script `types:gen` wrapping the §1.3 command; CI job that runs build/lint/test + the grep gates; consider seeding demo accounts in CI-able SQL rather than dashboard clicks.

---

## 6. Known nits (backlog; fix only if trivial while working nearby — no dedicated effort)

- Custom-refund input renders a hardcoded `$` prefix while everything else uses `formatMoney(currency)` — derive the prefix or use a suffix label.
- Multi-line partial refunds are sequential inserts; a mid-way failure leaves earlier lines recorded (DB guards prevent over-refund, so this is cosmetic for the demo).
- `guard_refund_amount` counts only `status='succeeded'` rows and doesn't lock the payment — concurrent inserts could race past the cap (single-admin demo: acceptable).
- Seed order 1004 is `pending` with a `succeeded` payment (intentional: exercises the open-order refund path — leave, but don't describe it as a real payment flow in the demo).
- The in-loop seed refund uses current `menu_items.price` instead of `unit_price_snapshot`; only matters if the seed runs in passes after price edits.
- No `revoke … from anon` on `restaurant_daily_stats` (harmless under security invoker + RLS; add it for consistency if touching that file anyway).

---

**Definition of done for this README:** §1–§3 committed/executed, §4 all green with results pasted in the final report, §5 untouched. Report anything in §4 that fails instead of silently patching.
