import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getStripe } from "./_lib/stripe";
import { adminClient, userClient } from "./_lib/supabaseAdmin";
import { bearer, json } from "./_lib/http";

type ItemInput = { menu_item_id: string; quantity: number };
type LocationInput = { latitude: number; longitude: number };

type Body = {
  restaurantSlug?: string;
  tableToken?: string;
  customerName?: string;
  notes?: string | null;
  items?: ItemInput[];
  location?: LocationInput;
};

function parseBody(req: VercelRequest): Body {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body) as Body;
  return req.body as Body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const { restaurantSlug, tableToken, customerName, notes, items, location } = parseBody(req);
    if (
      !restaurantSlug ||
      !tableToken ||
      !customerName ||
      !Array.isArray(items) ||
      !items.length
    ) {
      return json(res, 400, { error: "invalid_request" });
    }

    // 1) Create the order AS THE CALLER so auth.uid() sets customer_id for
    //    signed-in users and stays null for guests.
    const user = userClient(bearer(req));
    const { data: placed, error: placeErr } = await user.rpc("place_order", {
      p_restaurant_slug: restaurantSlug,
      p_table_token: tableToken,
      p_customer_name: String(customerName).trim(),
      p_notes: notes ? String(notes).trim() : null,
      p_items: items.map((item) => ({
        menu_item_id: item.menu_item_id,
        quantity: Math.trunc(Number(item.quantity)),
      })),
      p_customer_latitude: location?.latitude ?? null,
      p_customer_longitude: location?.longitude ?? null,
    });

    if (placeErr) return json(res, 400, { error: placeErr.message });
    if (!placed) return json(res, 500, { error: "order_not_created" });

    const orderId = placed.order_id as string;
    const amount = Number(placed.total);
    const currency = String(placed.currency ?? "AUD");

    // 2) Create the Stripe PaymentIntent (amount in minor units).
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: { orderId, restaurantSlug, tableToken },
    });

    // 3) Persist a pending payments row (service role; anon cannot write payments).
    const admin = adminClient();
    const { error: payErr } = await admin.rpc("record_payment_intent", {
      p_order_id: orderId,
      p_amount: amount,
      p_currency: currency,
      p_stripe_payment_intent_id: intent.id,
      p_method: null,
    });

    if (payErr) {
      // Best-effort cleanup so we don't strand an intent with no row.
      await stripe.paymentIntents.cancel(intent.id).catch(() => {});
      return json(res, 500, { error: "could_not_record_payment" });
    }

    return json(res, 200, {
      clientSecret: intent.client_secret,
      orderId,
      orderNumber: placed.order_number,
      trackingToken: placed.tracking_token,
      amount,
      currency,
      status: "pending",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return json(res, 500, { error: message });
  }
}
