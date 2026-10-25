# QuickTab Payments

QuickTab is a scan-to-order QR food pickup platform designed for cafés and takeaway restaurants.

Customers scan a physical QR code and open the restaurant's menu directly in their browser. They can browse the live menu, place an order at their table, and track its progress without downloading a mobile application. Online payment is intentionally deferred to Phase 6 (Stripe).

QuickTab is designed as a tool for individual restaurants rather than a marketplace. Each restaurant can have its own website and table-level QR codes.

## For the reviewer — quick start

This submission includes a preconfigured `.env.local` file with the demo Supabase
project URL and publishable key, plus a `DEMO_CREDENTIALS.md` file with the demo
accounts.

1. Install **Node.js 22.12 or newer** (LTS recommended) and npm.
2. From the project folder, install dependencies:
   ```bash
   npm ci
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open <http://localhost:5173/>.
5. Sign in at <http://localhost:5173/admin> using the account details in
   `DEMO_CREDENTIALS.md`.

If you received the project through GitHub instead of the submission folder,
`.env.local` and `DEMO_CREDENTIALS.md` are **not** included: they are git-ignored
on purpose. Ask the author for those files.

The hosted Supabase project must be online. Free Supabase projects pause after
a period of inactivity; if the app shows connection errors, the project owner
must unpause it in the Supabase dashboard.

## Project Goals

- Provide a simple QR-based ordering experience.
- Allow customers to browse a restaurant menu from their phone.
- Support table-based ordering and live order-status tracking.
- Give individual restaurants their own ordering experience.
- Reduce the friction of app downloads for customers.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + TypeScript |
| Build Tool | Vite |
| CSS Framework | Tailwind CSS |
| Backend & Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Real-Time Communication | Supabase Realtime |
| Payment Processing | Stripe — **deferred to Phase 6; not installed** |
| QR Code Generation | node-qrcode |
| Component Library | shadcn/ui for net-new Phase 5+ components; hand-rolled `src/shared/ui` elsewhere |
| Hosting & Deployment | Vercel |
| Unit Testing | Vitest |
| End-to-End Testing | Not configured (planned) |

## Getting Started

### Prerequisites

QuickTab uses Vite 8, React 19, and TypeScript 6, which require a recent Node.js
release. Install **Node.js 22.12 or newer** (the current LTS line or above is
recommended) along with npm. The repository includes an `.nvmrc` pinned to
Node 22 if you use nvm.

Check your versions with:

```bash
node -v
npm -v
```

The default setup only needs Node.js and an internet connection. Docker and the
Supabase CLI are **optional** and are only needed if you want to create your own
local database instead of using the hosted demo project.

### Installation

If you received the project as a folder or ZIP, open a terminal in that folder.

If you are cloning from GitHub:

```bash
git clone https://github.com/phelippe-ait/QuickTabPayments.git
cd QuickTabPayments
```

Install dependencies with the committed lockfile:

```bash
npm ci
```

`npm install` also works, but `npm ci` reproduces the exact dependency versions
used for the submission.

### Run the development server

Start the Vite development server:

```bash
npm run dev
```

Vite will display the local development URL in the terminal, normally:

```text
http://localhost:5173/
```

Vite includes its own development server and Hot Module Replacement (HMR), so
the project does not require the VS Code Live Server extension.

### Demo accounts

The demo Supabase project has three staff accounts. The passwords are in
`DEMO_CREDENTIALS.md` (included with the submission, excluded from Git).

| Role | Email | Where to use it |
| --- | --- | --- |
| Owner | `owner@quicktab.demo` | Full `/admin` access, plus `/staff` |
| Manager / staff | `manager@quicktab.demo` | `/admin` catalog, tables, users, orders, settings, plus `/staff` |
| Kitchen | `kitchen@quicktab.demo` | `/admin/orders` and `/staff` kitchen view |

The customer app works as a guest, so the reviewer can test the menu, cart,
simulated checkout, and guest tracking without signing in.

`/staff` has no login screen of its own. Sign in at `/admin` first, then open
`/staff` in the same browser session.

### Routes

The app serves several surfaces from the same build:

| Route | App |
| --- | --- |
| `/` | Customer app (browse, order, track) |
| `/order/:orderNumber?token=…` | Public guest order tracking |
| `/staff` | Staff dashboard (unguarded until Phase 7) |
| `/admin` | Admin dashboard |

Useful things to try:

- Open `/` and place an order with a name and notes, using one of the simulated
  payment methods.
- Open the tracking page from the order confirmation.
- Sign in at `/admin` as the owner and edit a menu item, a table, or the
  restaurant settings.
- Sign in as the kitchen account and use `/staff` or `/admin/orders` to move an
  order through its statuses.
- Open Admin → Tables and use a QR code, or open
  `/?r=quicktab-demo-cafe&t=<table-token>` directly to simulate a table scan.

## Available Scripts

```bash
npm run dev         # Start the development server
npm run build       # Build the application for production
npm run preview     # Preview the production build locally
npm run lint        # Run ESLint
npm run test        # Run the unit/integration test suite once
npm run test:watch  # Re-run tests on change while developing
npm run db:bundle   # Regenerate supabase/schema.sql from the migrations
npm run db:export   # Export the hosted database data (see Database setup)
```

## Environment Variables

The submission folder already contains `.env.local` with the hosted demo
project values. `.env.local` is git-ignored and is never committed.

If you need to recreate it, copy the example file:

```bash
cp .env.example .env.local
```

and fill in the values:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable / anon key>
VITE_RESTAURANT_SLUG=quicktab-demo-cafe
```

Both values are under **Project Settings → API Keys** in the Supabase dashboard.
Only the publishable/anon key belongs in the browser — Row Level Security
protects the data. Never put the `service_role`/secret key in a `VITE_`
variable.

Set `VITE_SUPABASE_URL` to the bare project origin
(`https://<project-ref>.supabase.co`) — no trailing slash and no `/rest/v1`
path, or the client will build invalid request URLs.

`VITE_RESTAURANT_SLUG=quicktab-demo-cafe` is a development-only fallback used
when the app is opened without `?r=&t=` QR params. Remove it to require a table
QR scan. It is also used by the staff dashboard to find the demo restaurant.

### Local Supabase values

If you run the Supabase CLI locally, replace the hosted values with the local
ones printed by `npx supabase status`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local publishable / anon key>
VITE_RESTAURANT_SLUG=quicktab-demo-cafe
```

Restart `npm run dev` after changing `.env.local`; Vite only reads environment
variables at startup.

## Authentication setup

The hosted demo project is already set up for email/password sign-in, and the
demo accounts are email-confirmed. No dashboard changes are needed for the
normal reviewer path. Google OAuth is optional; configure the URL settings
below only if you want to use it.

For a **new** Supabase project:

1. Enable **Authentication → Providers → Email**. For local development you can
   switch **Confirm email** off to skip the confirmation step.
2. Set **Authentication → URL Configuration → Site URL** to
   `http://localhost:5173` and add `http://localhost:5173/**` to the Redirect
   URLs.
3. Run the database schema and import the demo data (see
   [Database setup](#database-setup)).
4. Social logins (optional): enable **Google** under Providers. Its OAuth
   redirect URI must be
   `https://<project-ref>.supabase.co/auth/v1/callback`. Apple and Facebook are
   intentionally deferred; their buttons stay disabled.

In the customer app **Google and email/password** are the supported sign-in
methods. Apple and Facebook remain visible but disabled until configured.
Email/password is sufficient for the reviewer; Google OAuth requires additional
URL/provider configuration and is not required for the demo.

## QR scanning contract

Every table QR code encodes:

```text
{origin}/?r={restaurant.slug}&t={table.qr_token}
```

On boot the customer app:

1. parses `r` and `t` (`parseQrParams`);
2. resolves them through the `resolve_qr_context` RPC (active restaurant +
   active table, so a token from another restaurant is rejected);
3. keeps the resolved restaurant/table in memory and session storage;
4. removes `r`/`t` from the visible URL with `history.replaceState`.

Missing or partial params, an unknown restaurant, a wrong-restaurant token, and
a deactivated table each render a distinct error screen. Opening `/` with no QR
params uses `VITE_RESTAURANT_SLUG` (plus that restaurant's first active table)
only as a documented development fallback.

## Order placement and guest tracking

- Cart lines are keyed by `menu_item_id` and persisted in `sessionStorage` per
  restaurant + table. A refresh or same-tab Google OAuth redirect keeps the cart.
- The customer menu is loaded live from `menu_categories` / `menu_items`; admin
  edits, price changes, availability, and Storage images appear after reload.
- Admin → Catalog can edit each item's **prep time (minutes)**. Customers do
  not see per-item prep estimates or the order ETA; the value remains stored
  server-side for future operational use.
- Checkout collects a name and optional notes, then offers four **simulated**
  payment methods: Credit/Debit Card, Apple Pay, Google Pay, and Link. Selecting
  one runs a short fake authorization and then places the order. No Stripe SDK,
  network request, or `payments` row is involved; Stripe remains Phase 6.
- `place_order(...)` is a `SECURITY DEFINER` RPC. It validates the restaurant,
  table and every menu item, recomputes all prices/tax/totals server-side, and
  inserts `orders` + `order_items` atomically. The client only sends menu item
  ids and quantities.
- Pricing is **GST-inclusive**: `total = Σ(price × qty)`,
  `tax = round(total × rate / (1 + rate), 2)`, `subtotal = total − tax`.
- Each order gets an opaque `orders.tracking_token`. The public tracking route
  reads `get_order_tracking(token)` and never exposes arbitrary order rows.
  Guests poll every ~7 seconds (Realtime is RLS-filtered for anon); signed-in
  owners/staff also receive Realtime updates. Polling stops at
  `completed`/`cancelled`.
- Customer order history reads `order_items` and links to the same tracking page.

## Database setup

The default reviewer path uses the **hosted demo Supabase project** already
configured in `.env.local`. No database setup is required for that path.

The repository also contains everything needed to create a separate database
from scratch, either in a new Supabase cloud project or in a fully local
Supabase stack.

### `supabase/schema.sql` — one-file schema

`supabase/schema.sql` is generated from the numbered migrations in
`supabase/migrations/` (`0001` … `0015`). It creates the same tables, enums,
functions, RLS policies, triggers, storage buckets, and Realtime publication as
the migrations.

Use it when you want to create the schema by running **one SQL file**:

1. Open the Supabase SQL Editor for an **empty** project.
2. Paste the contents of `supabase/schema.sql`.
3. Run it once.

Important:

- This is a **Supabase** database, not plain PostgreSQL. The file expects the
  `auth` and `storage` schemas, the `anon` / `authenticated` / `service_role`
  roles, and the `supabase_realtime` publication to exist.
- It creates **schema only**. It does not create the demo restaurant, demo
  accounts, or menu/order data.
- The numbered migrations remain the source of truth. Regenerate the bundle
  after changing a migration:
  ```bash
  npm run db:bundle
  ```

### Option 1 — a new Supabase cloud project

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Import the demo data (see [Data export and import](#data-export-and-import)),
   or create the owner account and run `supabase/seed.sql` manually.
4. Copy the project URL and publishable key into `.env.local`.
5. Run `npm run dev`.

### Option 2 — a fully local Supabase stack

This is optional and requires Docker. It gives you the database, Auth, Storage,
Realtime, and Studio on your machine.

1. Install **Docker Desktop** (or OrbStack) and the **Supabase CLI**:
   ```bash
   npm install --save-dev supabase
   ```
   The repository already includes `supabase/config.toml`.
2. Start the stack:
   ```bash
   npx supabase start
   ```
   On the first run this applies the migrations and downloads the Docker
   images. `supabase/config.toml` disables the demo seed, because
   `supabase/seed.sql` expects the demo restaurant and accounts to exist
   already.
3. Copy the local API URL and publishable/anon key from:
   ```bash
   npx supabase status
   ```
4. Import the exported data (see below), or create the demo accounts manually
   in local Studio at <http://127.0.0.1:54323>.
5. Put the local values in `.env.local` and restart `npm run dev`.

Useful local commands:

```bash
npx supabase status          # Show URLs, keys, and database URL
npx supabase db reset        # Re-apply migrations (seed stays disabled)
npx supabase stop            # Stop the stack
npx supabase stop --no-backup # Stop and delete local data
```

### Data export and import

The hosted project's data can be exported for inspection or for a local copy.
The repository includes an export helper:

```bash
# Install the PostgreSQL client tools if pg_dump is not available:
#   macOS: brew install libpq
#          export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
#   Windows: install PostgreSQL client tools or use the Supabase CLI with Docker

DATABASE_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' \
  npm run db:export
```

Use the connection string from **Supabase Dashboard → Project Settings →
Database**. Use the direct connection string if available, or the session
pooler string on IPv4-only networks. The export produces two files:

| File | Contents | Needed for |
| --- | --- | --- |
| `supabase/auth_data.sql` | `auth.users` + `auth.identities` | Working local logins |
| `supabase/public_data.sql` | All `public` schema data (restaurant, menu, tables, orders, payments, refunds, profiles) | App data |

Both files are git-ignored. Include them in the folder/ZIP you give to the
reviewer, but do **not** publish them: `auth_data.sql` contains password
hashes.

The SQL dump does not include files stored in Supabase Storage (for example,
images uploaded through the admin UI). The demo café uses the local
`public/menu/*.jpg` assets, so it still renders correctly; storage-backed
images would need a separate Storage export.

Both dumps use `--inserts --on-conflict-do-nothing`, so the import is safe to
re-run. Import order matters: the auth users must exist before the public data
references them. The `handle_new_user()` trigger creates profile rows when the
auth users are inserted; the public dump's profile rows are then skipped
instead of causing duplicate-key errors.

**Import order:**

```bash
# 1. Schema (cloud project or a local database that has no schema yet).
#    For a local Supabase CLI project, skip this: `supabase start` already
#    applied the migrations.
psql "$DATABASE_URL" -f supabase/schema.sql

# 2. Auth accounts first, so profiles/staff/restaurant foreign keys resolve.
psql "$DATABASE_URL" -f supabase/auth_data.sql

# 3. Then the app data.
psql "$DATABASE_URL" -f supabase/public_data.sql
```

For a local Supabase stack, `$DATABASE_URL` is normally:

```text
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

If `psql` is not installed, install the PostgreSQL client tools (`libpq` on
macOS) or run the files through the Supabase Studio SQL Editor.

**Auth caveat:** the exported auth data is tied to the Supabase Auth version
that produced it. If the local stack is much newer or older, the insert may fail
because of schema differences. If that happens, either:

- create the three demo accounts manually in local Studio and use the demo seed
  instead of the exported data, or
- use a new cloud Supabase project, where the Auth schema is the same as the
  hosted project.

If you create users manually, their UUIDs will not match the exported
`profiles` / `restaurant_staff` / `restaurants.owner_id` rows, so use the
exported data or the demo seed instead of mixing both paths.

### Seed data (`supabase/seed.sql`)

`supabase/seed.sql` contains the demo café menu, tables, sample orders,
payments, and refunds. It is **not** a bootstrap: it looks up the existing
`quicktab-demo-cafe` restaurant and raises an error if the restaurant or demo
accounts are missing.

Use it only after the restaurant and owner account exist, for example in the
hosted project or after the data import. `supabase/config.toml` disables it for
the local stack so that `supabase start` does not fail on an empty database.

### Migrations and checks

The numbered migrations in `supabase/migrations/` are the source of truth:

- `0001` … `0015` create the profiles table, enums, tenants, menus, orders,
  payments, refunds, RLS policies, Storage buckets, staff management,
  restaurant invites, order placement, and guest tracking.
- `0015_phase5_order_placement.sql` adds `tracking_token`, `place_order`, and
  `get_order_tracking`.
- `supabase/schema.sql` is the generated one-file bundle. Do not edit it by
  hand; change the migrations and run `npm run db:bundle`.

`supabase/tests/rls_checks.sql` is a manual verification script: fill in the
`<...>` placeholders from the helper queries at the top of each section, run it
in the SQL Editor, and compare the printed results/comments. Phase 5 checks
cover guest placement, tampered prices, cross-restaurant items, deactivated
tables, guest tracking, and the unchanged `orders` select policy.

## Project Structure

The app is organised by feature surface rather than by generic `components/` and
`pages/` folders:

```text
QuickTabPayments/
├── public/                     # Static assets served as-is
├── scripts/
│   ├── build-schema-bundle.mjs # Generates supabase/schema.sql
│   └── export-db.sh            # Exports hosted data for local import
├── src/
│   ├── apps/
│   │   ├── customer/           # Customer app (QR menu, cart, checkout, tracking)
│   │   ├── staff/              # Staff dashboard (route: /staff)
│   │   └── admin/              # Admin dashboard (route: /admin)
│   ├── routes/
│   │   └── AppRoutes.tsx       # Router; lazy-loads each app
│   ├── shared/
│   │   ├── auth/               # AuthContext + useAuth hook
│   │   ├── lib/                # Supabase client, generated DB types, helpers
│   │   ├── types/              # Shared TypeScript types
│   │   └── ui/                 # Shared UI + shadcn primitives
│   ├── test/
│   │   └── setup.ts            # Vitest setup (Testing Library, jsdom shims)
│   ├── index.css
│   └── main.tsx                # App entry point
├── supabase/
│   ├── migrations/             # SQL migrations (source of truth)
│   ├── tests/                  # Manual RLS / RPC verification checks
│   ├── config.toml             # Local Supabase CLI configuration
│   ├── schema.sql              # Generated one-file schema bundle
│   ├── seed.sql                # Demo menu/order data (not a bootstrap)
│   ├── auth_data.sql           # Exported auth data (git-ignored)
│   └── public_data.sql         # Exported public data (git-ignored)
├── .env.example
├── .env.local                  # Hosted demo credentials (git-ignored)
├── DEMO_CREDENTIALS.md         # Demo account passwords (git-ignored)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

Each app folder co-locates its styles and tests (e.g. `App.module.css`,
`App.test.tsx`). The exact structure may grow as additional features are
implemented.

## Development Workflow

1. Create or update a feature in `src/`.
2. Run the development server with `npm run dev`.
3. Check the application in the browser.
4. Run linting and tests before committing changes.
5. Create a Git commit with a descriptive message.
6. If you changed a migration, regenerate the bundle with `npm run db:bundle`.

## Testing

Unit and integration tests use **Vitest** with **React Testing Library**, running
against a jsdom environment. The configuration lives in `vitest.config.ts` and
`src/test/setup.ts`; test files sit next to the code they cover as
`*.test.ts(x)` and are discovered under `src/`.

```bash
npm run test        # Run the suite once
npm run test:watch  # Re-run on change while developing
```

The suite covers the customer QR/menu/cart/checkout/tracking data layer, admin
mappers, and shared helpers. No end-to-end suite is configured in this phase.

## Build and Deployment

A production build can be created locally with:

```bash
npm run build
```

The generated production files are placed in the `dist/` directory.

The project is intended to be deployed using **Vercel**. When deploying, set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the project's environment
variables, and in Supabase **Authentication → URL Configuration** set the Site
URL to the deployed origin and add both `https://<domain>/**` and
`http://localhost:5173/**` to the Redirect URLs. The `vercel.json` SPA rewrite
keeps `/admin`, `/staff`, and `/order/:number` working on a hard refresh.

Known risk (until Phase 7): the `/staff` route has no auth gate. It still needs
a signed-in staff account to load restaurant data, but the route itself is not
protected.

## Troubleshooting

### “Supabase is not configured”

`.env.local` is missing or does not contain both values. Copy `.env.example` to
`.env.local` and fill in the URL/key, then restart `npm run dev`.

### The app loads but there is no menu / every request fails

The hosted Supabase project is probably paused or unavailable. The project
owner must unpause it in the Supabase dashboard. Free projects pause after a
period of inactivity.

### Admin sign-in fails

Use the exact email/password pairs in `DEMO_CREDENTIALS.md`. Email confirmation
must already be complete for those accounts. Google sign-in is optional and is
not configured for localhost; use email/password.

### `/staff` says “No active staff restaurant found”

`/staff` has no login screen. Sign in at `/admin` with a staff account first,
then open `/staff` in the same browser session.

### Node version errors

QuickTab requires Node.js 22.12 or newer. Check `node -v` and install the
current LTS release if needed. The repository includes `.nvmrc` for nvm users:

```bash
nvm use
```

### Local Supabase / Docker errors

- Make sure Docker Desktop or OrbStack is running.
- Start the stack with `npx supabase start`.
- If a port is already in use, stop other local Supabase projects with
  `npx supabase stop --all`, or adjust the ports in `supabase/config.toml`.
- `supabase/config.toml` disables the demo seed. If you use an older generated
  config, set `[db.seed] enabled = false` before `npx supabase start`.

### Import fails with a foreign-key error

Import `supabase/auth_data.sql` **before** `supabase/public_data.sql`. The
public data references auth user IDs through `profiles`, `restaurant_staff`,
and `restaurants.owner_id`. Both dumps use `ON CONFLICT DO NOTHING`, so
re-running them is safe.

### `pg_dump: command not found`

Install the PostgreSQL client tools:

```bash
# macOS
brew install libpq
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
```

Then rerun `npm run db:export` with `DATABASE_URL` set.

### Reset the local database

```bash
npx supabase db reset
```

This re-applies the migrations. The seed is disabled, so import the data files
again afterwards if you need the demo data.

## Project Documentation

The project proposal and research cover the technology choices, system design, testing strategy, deployment approach, security considerations, and business model for QuickTab.

## Repository

GitHub: <https://github.com/phelippe-ait/QuickTabPayments>

## License

This project is currently being developed as part of an academic project at AIT (Academy of Interactive Technology).
