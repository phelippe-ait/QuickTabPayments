# `src/shared`

Cross-app code used by more than one of the three applications
(`src/apps/customer`, `src/apps/staff`, `src/apps/admin`).

```
src/shared/
├── auth/          AuthProvider + useAuth (Supabase session)
├── components/
│   └── ui/        Reusable primitives (Button, Card, Modal, StatusPill, ...)
├── data/          Typed Supabase reads/writes (client, restaurants, invites, menu, tables, orders, refunds)
├── hooks/         Cross-app React hooks
├── lib/           Framework-agnostic helpers (cn, money, qr, storage, time, supabase, database.types)
├── orders/        Order status labels, tones, and the legal transition matrix
├── restaurant/    RestaurantProvider (membership + role context)
└── types/         Shared domain types (aligned with /database/schema.sql)
```

## Data layer contract

- Components never call Supabase directly: page → `apps/admin/hooks/useX`
  (TanStack Query) → `shared/data/*` → client.
- Every data function throws `Error` with a user-facing message; hooks surface
  failures through toasts. Success toasts only fire after the server confirms.
- `lib/database.types.ts` is maintained locally: the linked project's types can
  be regenerated with `npx supabase gen types typescript --linked`, then the
  `PublicSchema`/shorthand exports at the bottom are kept by hand.
- Money is numeric in the database and formatted only via
  `lib/money.ts → formatMoney`; never parse a formatted string. GST-inclusive
  splits use `splitInclusiveTax` (mirrors `place_order`).
- QR URLs are built only via `lib/qr.ts → buildTableQrUrl`:
  `{origin}/?r={slug}&t={qr_token}`.
- Storage paths follow `lib/storage.ts`: `restaurant-assets/{restaurant_id}/…`
  and `menu-items/{restaurant_id}/{item_id}.…` (public read, staff-gated write).

## Rules

- **Import via aliases**: `@shared/ui/Button`, `@shared/lib/cn`, `@shared/types`.
  Never use long relative paths across apps.
- **Only put code here once a second app needs it.** App-specific UI stays in
  `src/apps/<app>/`.
- **Style with design tokens** (see below), not raw hex.

## Design tokens

The canonical palette/typography/radii/shadows live in `src/index.css` under
`@theme` and generate Tailwind utilities:

| Token group | Examples | Utilities |
| --- | --- | --- |
| Brand | `--color-berry`, `--color-berry-strong`, `--color-berry-soft` | `bg-berry`, `text-berry` |
| Surfaces | `--color-cream`, `--color-cream-2`, `--color-cream-3`, `--color-paper`, `--color-sand` | `bg-cream` |
| Text | `--color-ink`, `--color-ink-dark`, `--color-ink-soft`, `--color-ink-mid`, `--color-muted`, `--color-muted-2`, `--color-placeholder` | `text-ink` |
| Borders | `--color-line`, `--color-line-soft`, `--color-line-2` | `border-line` |
| Status | `--color-sage`, `--color-amber`, `--color-info`, `--color-danger`, `--color-neutral` (+ `-soft`) | `bg-sage-soft` |
| Fonts | `--font-sans`, `--font-serif`, `--font-ui` | `font-sans`, `font-serif` |
| Radii | `--radius-card`, `--radius-lg`, `--radius-md`, `--radius-sm` | `rounded-card` |
| Shadows | `--shadow-card`, `--shadow-float`, `--shadow-drawer` | `shadow-card` |

New components must use these tokens. The existing three apps still contain
legacy raw hex and will be migrated to tokens as primitives are extracted.
