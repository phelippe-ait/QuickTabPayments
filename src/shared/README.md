# `src/shared`

Cross-app code used by more than one of the three applications
(`src/apps/customer`, `src/apps/staff`, `src/apps/admin`).

```
src/shared/
├── components/
│   └── ui/        Reusable primitives (Button, Card, Modal, StatusPill, ...)
├── hooks/         Cross-app React hooks
├── lib/           Framework-agnostic helpers (cn, formatters, api clients)
└── types/         Shared domain types (aligned with /database/schema.sql)
```

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
