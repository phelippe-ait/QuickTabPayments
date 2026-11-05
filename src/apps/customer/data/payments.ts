import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { supabase } from "@shared/lib/supabase";
import type { CartItem } from "../types";
import type { PlaceOrderErrorCode } from "./placeOrder";

const publishableKey = (
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? ""
).trim();

/** Empty when payments are not configured; checkout shows an honest notice. */
export const stripePublishableKey = publishableKey;

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> | null {
  if (!publishableKey) return null;
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

export type CreatePaymentIntentInput = {
  restaurantSlug: string;
  tableToken: string;
  customerName: string;
  notes?: string;
  items: CartItem[];
};

export type PaymentIntentResponse = {
  clientSecret: string;
  orderId: string;
  orderNumber: string;
  trackingToken: string;
  amount: number;
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
  "order_number_conflict",
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
        })),
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!res.ok) {
    const message = payload.error ?? "payment_setup_failed";
    const code = ERROR_CODES.find((candidate) => message.includes(candidate));
    throw new PaymentSetupError(code ?? "unknown", message);
  }

  return payload as PaymentIntentResponse;
}
