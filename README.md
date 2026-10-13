# QuickTab Payments

QuickTab is a scan-to-order QR food pickup platform designed for cafés and takeaway restaurants.

Customers scan a physical QR code and open the restaurant's menu directly in their browser. They can browse the menu, place an order, and pay without downloading a mobile application.

QuickTab is designed as a tool for individual restaurants rather than a marketplace. Each restaurant can have its own website and table-level QR codes.

## Project Goals

- Provide a simple QR-based ordering experience.
- Allow customers to browse a restaurant menu from their phone.
- Support online ordering and secure payment processing.
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
| Payment Processing | Stripe |
| QR Code Generation | node-qrcode |
| Component Library | shadcn/ui |
| Hosting & Deployment | Vercel |
| Unit Testing | Vitest |
| End-to-End Testing | Playwright |

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
| `/` | Customer app (browse, order, pay) |
| `/staff` | Staff dashboard |
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

### Authentication setup

1. **Authentication → Providers → Email**: enable it. For local development you can
   switch **Confirm email** off to skip the confirmation step.
2. **Authentication → URL Configuration**: set the Site URL to `http://localhost:5173`
   and add `http://localhost:5173/**` to the Redirect URLs.
3. Run `supabase/migrations/0001_profiles.sql` in the SQL Editor. It creates the
   `profiles` table (with RLS) and a trigger that fills it whenever a user signs up.
4. Social logins (optional): enable **Google** (and later Apple/Facebook) under
   Providers. Each provider's OAuth redirect URI must be
   `https://<project-ref>.supabase.co/auth/v1/callback`.

In the customer app the Google, Apple, and Facebook buttons are shown but disabled
until those providers are configured; email is the live sign-in method.

## Project Structure

The app is organised by feature surface rather than by generic `components/` and
`pages/` folders:

```text
QuickTabPayments/
├── public/                     # Static assets served as-is
├── src/
│   ├── apps/
│   │   ├── customer/           # Customer app (route: /)
│   │   ├── staff/              # Staff dashboard (route: /staff)
│   │   └── admin/              # Admin dashboard (route: /admin)
│   ├── routes/
│   │   └── AppRoutes.tsx       # Router; lazy-loads each app
│   ├── shared/
│   │   ├── auth/               # AuthContext + useAuth hook
│   │   ├── lib/                # Supabase client, generated DB types, helpers
│   │   ├── types/              # Shared TypeScript types
│   │   └── ui/                 # Shared UI components (Button, Icon, StatusPill)
│   ├── test/
│   │   └── setup.ts            # Vitest setup (Testing Library, jsdom shims)
│   ├── index.css
│   └── main.tsx                # App entry point
├── supabase/
│   └── migrations/             # SQL migrations (run in the Supabase SQL Editor)
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

End-to-end coverage is planned with **Playwright**, but it is not configured in
the repository yet.

## Deployment

The project is intended to be deployed using **Vercel**.

A production build can be created locally with:

```bash
npm run build
```

The generated production files are placed in the `dist/` directory.

When deploying to Vercel, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
the project's environment variables, and add the deployed domain to Supabase under
**Authentication → URL Configuration** (Site URL and Redirect URLs).

## Project Documentation

The project proposal and research cover the technology choices, system design, testing strategy, deployment approach, security considerations, and business model for QuickTab.

## Repository

GitHub: https://github.com/phelippe-ait/QuickTabPayments

## License

This project is currently being developed as part of an academic project at AIT (Academy of Interactive Technology).
