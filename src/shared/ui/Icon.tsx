import type { ReactNode } from "react";

/**
 * The canonical icon set for the whole product.
 *
 * This is the superset of every icon the customer, staff, and admin apps used
 * independently before, so a single component can serve all three. Add new
 * glyphs here — do not create per-app icon components.
 */
export type IconName =
  // customer
  | "menu"
  | "search"
  | "sliders"
  | "cart"
  | "close"
  | "back"
  | "card"
  // staff
  | "grid"
  | "kitchen"
  | "receipt"
  | "calendar"
  | "settings"
  | "bell"
  | "users"
  | "clock"
  | "arrow"
  | "check"
  | "chevron"
  // admin
  | "catalog"
  | "tables"
  | "orders"
  | "plus"
  | "edit"
  | "trash"
  | "logout"
  | "coffee"
  | "download";

const paths: Record<IconName, ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  sliders: (
    <>
      <path d="M5 7h14M5 12h14M5 17h14" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="11" cy="17" r="2" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20 8H7" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="m15 18-6-6 6-6M9 12h11" />,
  card: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  kitchen: (
    <>
      <path d="M5 3v7a3 3 0 0 0 3 3V3M5 7h3M8 13v8" />
      <path d="M16 3v18M16 3c3 1 4 4 3 8h-3" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3V3h4v.08a1.7 1.7 0 0 0 1.06 1.52 1.7 1.7 0 0 0 1.88-.34L17 4.2 19.8 7l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.4.6 1 1.52 1H21v4h-.08c-.92 0-1.38.6-1.52 1Z" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  catalog: (
    <>
      <path d="M4 5.5h16M4 12h16M4 18.5h16" />
      <circle cx="7" cy="5.5" r=".7" fill="currentColor" />
      <circle cx="7" cy="12" r=".7" fill="currentColor" />
      <circle cx="7" cy="18.5" r=".7" fill="currentColor" />
    </>
  ),
  tables: <path d="M4 9h16M6 9V5h12v4M7 9v11M17 9v11M5 20h4M15 20h4" />,
  orders: (
    <>
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" />
      <path d="M9 7h6M9 11h6M9 15h3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  trash: <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />,
  logout: (
    <>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 7h13v7a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V7Z" />
      <path d="M17 9h1a3 3 0 0 1 0 6h-1M7 3v2M11 3v2M15 3v2" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
};

export type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function Icon({ name, size = 20, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
