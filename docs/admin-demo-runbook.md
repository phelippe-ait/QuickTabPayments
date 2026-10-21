# QuickTab Admin — demo runbook

> Audience: whoever runs the 10-minute walkthrough.
> Branch: `feature/admin-app`. Customer and staff apps are unchanged.

---

## 1. Environment

- `.env.local` (never committed) contains `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`. `.env.example` has the empty keys.
- `npm run dev`, or deploy the Vite build. Admin lives at `/admin`.
- Do not put a `service_role` key in client code or `VITE_*` variables.

## 2. Database state

Migrations are applied in filename order. Current head: `0011_staff_directory.sql`.

Already applied to the linked project:

| File | What it adds |
| --- | --- |
| `0005_storage.sql` | `restaurant-assets` + `menu-items` buckets, staff-folder write policies |
| `0006_restaurants_manager_update.sql` | `is_manager_of`, manager settings updates, owner-only column trigger |
| `0007_onboarding_rpc.sql` | atomic `create_restaurant_with_owner` |
| `0008_tables_seats.sql` | `tables.seats` (1–12, null for Pick-up) |
| `0009_orders_snapshot_and_stats.sql` | `orders.customer_name_snapshot`, `restaurant_daily_stats` |
| `0010_refunds.sql` | `refunds`, amount/quantity guards, staff RLS |
| `0011_staff_directory.sql` | directory + add-by-email RPCs, manager staff policy |

### Fresh environment (CLI not authenticated)

1. Supabase dashboard → SQL editor → paste each file from
   `supabase/migrations/` in order → Run.
2. If bucket creation is blocked by dashboard permissions, create
   `restaurant-assets` and `menu-items` manually: public, 5 MB,
   `image/jpeg`, `image/png`, `image/webp`. Apply `0005` policies anyway.
3. Hand-update `src/shared/lib/database.types.ts` for the migration.
4. When the CLI is authenticated:
   `npx supabase gen types typescript --project-id <ref> > src/shared/lib/database.types.ts`.

### Seed / reseed

```bash
npx supabase db push --linked          # apply pending migrations
npx supabase db query --linked --file supabase/seed.sql
```

`seed.sql` targets `quicktab-demo-cafe`, is idempotent, and skips existing
orders. It adds 4 categories, 12 items, 9 tables, 16 orders (with line items,
payments, and two refunds) and links staff memberships by email when the
accounts exist.

**Demo accounts** (create via Dashboard → Authentication → Users, email
confirmed; password lives outside the repo):

- `owner@quicktab.demo`
- `manager@quicktab.demo`
- `kitchen@quicktab.demo`

The seed sets manager/kitchen names and memberships if those profiles exist.
Unknown emails in “Add team member” show the “ask them to sign up first” error —
that is intentional.

### Teardown before a fresh seed

Uncomment the teardown block at the top of `supabase/seed.sql` and run it, then
rerun the seed. It deletes only data scoped to `quicktab-demo-cafe`.

## 3. RLS verification

`supabase/tests/rls_checks.sql` contains impersonation checks for M2–M7
(manager settings, storage writes, tables, orders/stats, refunds, directory).
Replace the `<...>` placeholders with real ids from the helper queries at the
top, then run each `begin; … rollback;` block in the SQL editor. All blocks are
rolled back.

## 4. 10-minute demo script

1. **(0:00–1:00) Sign in as owner.** Land on Catalog. Point out the data is
   from Supabase and survives refresh.
2. **(1:00–2:30) Catalog.** Edit a price, upload a photo (Storage object +
   public URL in `image_url`), toggle availability. Rename a section; try
   deleting a section with items → blocked → move items → delete. Hard refresh.
3. **(2:30–3:30) Tables.** Add `T09` with seats. Open the QR preview: the URL
   is `{origin}/?r=quicktab-demo-cafe&t=<16-hex>`. Download the printable sheet;
   header is the real restaurant name. Refresh.
4. **(3:30–5:30) Orders.** Stats come from Postgres (`today` vs `yesterday`).
   Filter/search; open an order by deep link; walk
   pending → confirmed → preparing → ready → completed (`completed_at` set).
   Tables page shows the table Free after refresh. Optional: insert an order in
   the SQL editor and watch it appear within 30 s (polling, not realtime).
5. **(5:30–7:00) Refunds.** On a completed order with a succeeded payment,
   refund one line, then a custom amount. Attempt an over-refund → DB trigger
   rejection. Refresh → history persists. Say clearly: “Stripe is stubbed; the
   refund is recorded in QuickTab only.”
6. **(7:00–8:30) Users.** Real directory names/emails from the RPC. Demote a
   manager to kitchen in a second browser; their admin narrows on refresh.
   Add-by-email: show the unknown-email error, then a success. Owner rows and
   your own row are locked. Managers may manage kitchen rows but not peer
   managers; owner rows are owner-only. The last active owner cannot be
   deactivated or demoted, and adding your own email is rejected.
7. **(8:30–9:30) Settings.** Change description + tax rate, replace the logo.
   Refresh. Mention managers can edit profile fields but not the slug.
8. **(9:30–10:00) Close.** Grep gate on fixtures, `npm test` output, roadmap:
   Stripe refunds, realtime, customer/staff wiring, invitations via Edge
   Function.

## 5. Definition of demo-ready

- [ ] `npm run build`, `npm run lint`, `npm test` green on the demo commit.
- [ ] `grep -R "fixtures\|starterOrders\|starterItems\|starterTables\|starterUsers" src/apps/admin` → no hits.
- [ ] Seed freshly applied; demo users confirmed and linked.
- [ ] Hard refresh works on `/admin/catalog`, `/admin/tables`, `/admin/users`,
      `/admin/orders`, `/admin/orders/:id`, `/admin/settings`.
- [ ] Kitchen login sees orders only; deep links to other sections are blocked.
- [ ] QR sheet opens `{origin}/?r=…&t=…` (customer resolution is future work).
- [ ] Refund flag story matches: recorded in QuickTab, Stripe payout pending.
- [ ] Demo rehearsed on the deployed domain; use email/password if Google OAuth
      has not been rehearsed there.

## 6. Known limits (say them out loud if asked)

- Customer/staff apps still use their own mock data; admin writes do not appear
  there yet.
- QR links are correct but the customer app does not resolve `r`/`t` yet.
- Refunds do not call Stripe.
- Invitations require an existing QuickTab account; real email invitations need
  an Edge Function with `service_role`.
- Polling (30 s) replaces realtime for this demo.
- Refund state is shown as per-row pills and on the order detail; filtering all
  orders by refunded state across pages is post-demo.
