import type { Stripe } from "@stripe/stripe-js";
import { supabase } from "@shared/lib/supabase";
import type { TipSelection } from "@shared/lib/money";
import type { CartItem } from "../types";
import {
  placeOrderErrorMessage,
  type PlaceOrderErrorCode,
} from "./placeOrder";
import type { CustomerLocation } from "./geolocation";

const publishableKey = (
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? ""
).trim();

/** Empty when payments are not configured; checkout shows an honest notice. */
export const stripePublishableKey = publishableKey;

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> | null {
  if (!publishableKey) return null;
  if (!stripePromise) {
    // Loaded on demand: the SDK belongs to the checkout chunk, not the menu.
    stripePromise = import("@stripe/stripe-js").then(({ loadStripe }) =>
      loadStripe(publishableKey),
    );
  }
  return stripePromise;
}

export type CreatePaymentIntentInput = {
  restaurantSlug: string;
  tableToken: string;
  customerName: string;
  notes?: string;
  items: CartItem[];
  location?: CustomerLocation;
  /** Optional tip; `null` means no tip. The RPC recomputes the amount. */
  tip?: TipSelection | null;
};

export type PaymentIntentResponse = {
  clientSecret: string;
  orderId: string;
  orderNumber: string;
  trackingToken: string;
  /** Amount actually charged (items total + tip). */
  amount: number;
  /** GST-inclusive items total, before the tip. */
  total?: number;
  tipAmount?: number;
  /** Server-computed `amount_due`; mirrors `amount` when present. */
  amountDue?: number;
  currency: string;
  status: "pending";
};

/** Map an API error string back to the checkout error codes we already show. */
const ERROR_CODES: PlaceOrderErrorCode[] = [
  "empty_cart",
  "customer_name_required",
  "invalid_item",
  "invalid_quantity",
  "restaurant_not_found",
  "table_not_found",
  "menu_item_unavailable",
  "invalid_modifier_selection",
  "modifier_selection_invalid",
  "modifier_required",
  "invalid_modifier",
  "order_number_conflict",
  "customer_location_required",
  "customer_location_invalid",
  "outside_ordering_radius",
  "restaurant_location_not_configured",
  "invalid_tip",
];

export class PaymentSetupError extends Error {
  readonly code: PlaceOrderErrorCode;

  constructor(code: PlaceOrderErrorCode, message?: string) {
    super(message);
    this.name = "PaymentSetupError";
    this.code = code;
  }
}

export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<PaymentIntentResponse> {
  let token: string | null = null;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  }

  const res = await fetch("/api/create-payment-intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      restaurantSlug: input.restaurantSlug,
      tableToken: input.tableToken,
      customerName: input.customerName,
      notes: input.notes,
      items: input.items
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          menu_item_id: item.menuItemId,
          quantity: Math.trunc(item.quantity),
          ...((item.modifiers?.length ?? 0) > 0
            ? { modifiers: item.modifiers!.map((modifier) => modifier.id) }
            : {}),
        })),
      location: input.location,
      tip: input.tip ?? null,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!res.ok) {
    const message = payload.error ?? "payment_setup_failed";
    const code = ERROR_CODES.find((candidate) => message.includes(candidate));
    throw new PaymentSetupError(
      code ?? "unknown",
      code ? placeOrderErrorMessage(code) : message,
    );
  }

  return payload as PaymentIntentResponse;
}
