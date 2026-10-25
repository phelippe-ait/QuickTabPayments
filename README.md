# QuickTab Payments

QuickTab is a scan-to-order QR food pickup platform designed for cafés and takeaway restaurants.

Customers scan a physical QR code and open the restaurant's menu directly in their browser. They can browse the live menu, place an order at their table, and track its progress without downloading a mobile application. Online payment is intentionally deferred to Phase 6 (Stripe).

QuickTab is designed as a tool for individual restaurants rather than a marketplace. Each restaurant can have its own website and table-level QR codes.

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
recommended) along with npm.

Check your versions with:

```bash
node -v
npm -v
```

### Installation

Clone the repository:

```bash
git clone https://github.com/phelippe-ait/QuickTabPayments.git
cd QuickTabPayments
```

Install dependencies:

```bash
npm install
```

### Run the development server

Start the Vite development server:

```bash
npm run dev
```

Vite will display the local development URL in the terminal, normally:

```text
http://localhost:5173/
```

Vite includes its own development server and Hot Module Replacement (HMR), so the project does not require the VS Code Live Server extension.

The app serves three surfaces from the same build:

| Route | App |
| --- | --- |
| `/` | Customer app (browse, order, track) |
| `/order/:orderNumber?token=…` | Public guest order tracking |
| `/staff` | Staff dashboard (unguarded until Phase 7) |
| `/admin` | Admin dashboard |

## Available Scripts

```bash
npm run dev         # Start the development server
npm run build       # Build the application for production
npm run preview     # Preview the production build locally
npm run lint        # Run ESLint
npm run test        # Run the unit/integration test suite once
npm run test:watch  # Re-run tests on change while developing
```

## Environment Variables

Copy the example file and fill in your Supabase project values:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable / anon key>
```

Both are under **Project Settings → API Keys** in the Supabase dashboard. Only the
publishable/anon key belongs in the browser — Row Level Security protects the data.
Never put the `service_role`/secret key in a `VITE_` variable. `.env.local` is git-ignored.

Set `VITE_SUPABASE_URL` to the bare project origin (`https://<project-ref>.supabase.co`)
— no trailing slash and no `/rest/v1` path, or the client will build invalid request URLs.

Optional: `VITE_RESTAURANT_SLUG=quicktab-demo-cafe` is a development-only fallback
used when the app is opened without `?r=&t=` QR params. Remove it to require a
table QR scan.

### Authentication setup

1. **Authentication → Providers → Email**: enable it. For local development you can
   switch **Confirm email** off to skip the confirmation step.
2. **Authentication → URL Configuration**: set the Site URL to `http://localhost:5173`
   and add `http://localhost:5173/**` to the Redirect URLs.
3. Run the SQL migrations in `supabase/migrations/` in order in the SQL Editor:
   `0001_profiles.sql` creates the `profiles` table (with RLS) and a trigger
   that fills it whenever a user signs up. `0002_roles.sql` historically added
   a global `roles` lookup and `profiles.role`; `0012_drop_global_roles.sql`
   removes that unused layer. Authorization is per restaurant via
   `restaurant_staff.role` (`owner`, `manager`, `kitchen`).
4. Social logins (optional): enable **Google** under Providers. Its OAuth redirect
   URI must be `https://<project-ref>.supabase.co/auth/v1/callback`. Apple and
   Facebook are intentionally deferred; their buttons stay disabled.

In the customer app **Google and email/password** are the supported sign-in
methods. Apple and Facebook remain visible but disabled until configured.

### QR scanning contract

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

### Order placement and guest tracking

- Cart lines are keyed by `menu_item_id` and persisted in `sessionStorage` per
  restaurant + table. A refresh or same-tab Google OAuth redirect keeps the cart.
- The customer menu is loaded live from `menu_categories` / `menu_items`; admin
  edits, price changes, availability, and Storage images appear after reload.
- Checkout is an **order placement** step, not payment. It collects a name and
  optional notes. Payment is collected at the counter until Phase 6.
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

### Database migrations and checks

Migrations are applied manually in the Supabase SQL Editor, in order
(`0001` … `0015_phase5_order_placement.sql`). `0015` adds `tracking_token`,
`place_order`, `get_order_tracking`, and `resolve_qr_context`.

`supabase/tests/rls_checks.sql` is a manual verification script: fill in the
`<...>` placeholders from the helper queries at the top of each section, run it
in the SQL Editor, and compare the printed results/comments. Phase 5 checks cover
guest placement, tampered prices, cross-restaurant items, deactivated tables,
guest tracking, and the unchanged `orders` select policy.

## Project Structure

The app is organised by feature surface rather than by generic `components/` and
`pages/` folders:

```text
QuickTabPayments/
├── public/                     # Static assets served as-is
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
│   ├── migrations/             # SQL migrations (run in the Supabase SQL Editor)
│   └── tests/                  # Manual RLS / RPC verification checks
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

Each app folder co-locates its styles and tests (e.g. `App.module.css`,
`App.test.tsx`). The exact structure may grow as additional features are implemented.

## Development Workflow

1. Create or update a feature in `src/`.
2. Run the development server with `npm run dev`.
3. Check the application in the browser.
4. Run linting and tests before committing changes.
5. Create a Git commit with a descriptive message.

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

## Deployment

The project is intended to be deployed using **Vercel**.

A production build can be created locally with:

```bash
npm run build
```

The generated production files are placed in the `dist/` directory.

When deploying to Vercel, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
the project's environment variables, and in Supabase **Authentication → URL
Configuration** set the Site URL to the deployed origin and add both
`https://<domain>/**` and `http://localhost:5173/**` to the Redirect URLs. The
`vercel.json` SPA rewrite keeps `/admin`, `/staff`, and `/order/:number` working
on a hard refresh.

Known risk (until Phase 7): the `/staff` route has no auth gate.

## Project Documentation

The project proposal and research cover the technology choices, system design, testing strategy, deployment approach, security considerations, and business model for QuickTab.

## Repository

GitHub: https://github.com/phelippe-ait/QuickTabPayments

## License

This project is currently being developed as part of an academic project at AIT (Academy of Interactive Technology).
