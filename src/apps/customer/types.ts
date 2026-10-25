export type Screen =
  | "menu"
  | "cart"
  | "checkout"
  | "confirmation"
  | "login"
  | "signup"
  | "orders";

/** A sellable menu item loaded from `public.menu_items`. */
export type MenuItem = {
  id: string;
  name: string;
  description: string;
  /** GST-inclusive price, exactly as stored in the database. */
  price: number;
  imageUrl: string | null;
  /** Optional CSS background position retained for seeded demo imagery. */
  imagePosition?: string;
  allergens: string[];
  prepTimeMinutes: number;
  categoryId: string;
  displayOrder: number;
};

/** A menu section loaded from `public.menu_categories`, with its items. */
export type MenuCategory = {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  items: MenuItem[];
};

/** Cart lines are keyed by `menu_item_id`; the price is display-only. */
export type CartItem = {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

/** Resolved QR destination, held for the life of the session. */
export type QrContext = {
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  currency: string;
  taxRate: number;
  tableId: string;
  tableToken: string;
  tableNumber: string;
};

export type QrErrorCode =
  | "missing_params"
  | "no_context"
  | "restaurant_not_found"
  | "table_not_found"
  | "table_inactive"
  | "unknown";

/**
 * Payment methods offered at checkout. They are simulated in Phase 5; the
 * Stripe integration in Phase 6 will use the same identifiers.
 */
export const simulatedPaymentMethods = [
  "card",
  "apple_pay",
  "google_pay",
  "link",
] as const;

export type SimulatedPaymentMethod = (typeof simulatedPaymentMethods)[number];

export const simulatedPaymentLabels: Record<SimulatedPaymentMethod, string> = {
  card: "Credit / Debit Card",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  link: "Link",
};

export function isSimulatedPaymentMethod(
  value: unknown,
): value is SimulatedPaymentMethod {
  return (
    typeof value === "string" &&
    (simulatedPaymentMethods as readonly string[]).includes(value)
  );
}

export function qrErrorMessage(code: QrErrorCode): string {
  switch (code) {
    case "missing_params":
      return "This QR code is incomplete. Please scan the QR code on your table again."
    case "restaurant_not_found":
      return "We couldn't find this restaurant. It may have closed or the QR code may be out of date."
    case "table_inactive":
      return "This table is no longer accepting orders. Please ask a team member for help."
    case "table_not_found":
      return "This QR code doesn't match this restaurant. Please scan the QR code printed on your table."
    case "no_context":
      return "Scan the QR code on your table to see the menu and place an order."
    default:
      return "We couldn't open this menu. Please check your connection and try again."
  }
}
