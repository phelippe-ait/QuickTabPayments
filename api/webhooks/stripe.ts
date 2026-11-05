import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import { getStripe } from "../_lib/stripe.js";
import { adminClient } from "../_lib/supabaseAdmin.js";
import { serverEnv } from "../_lib/env.js";
import { readRawBody } from "../_lib/http.js";

/**
 * Stripe webhook. Signature-verified and idempotent: the RPCs guard on the
 * current payment status, so redeliveries are safe no-ops.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const signature = req.headers["stripe-signature"];
  const { STRIPE_WEBHOOK_SECRET } = serverEnv();
  if (!signature || !STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ error: "missing_signature" });
  }

  let event: Stripe.Event;
  try {
    const raw = await readRawBody(req);
    event = getStripe().webhooks.constructEvent(
      raw,
      Array.isArray(signature) ? signature[0] : signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    return res.status(400).json({
      error: `invalid_signature: ${(error as Error).message}`,
    });
  }

  const admin = adminClient();
  const stripe = getStripe();

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const method = intent.payment_method_types?.[0] ?? null;
      const receipt =
        typeof intent.latest_charge === "string"
          ? await stripe.charges
              .retrieve(intent.latest_charge)
              .then((charge) => charge.receipt_url ?? null)
              .catch(() => null)
          : intent.latest_charge?.receipt_url ?? null;

      await admin.rpc("apply_payment_succeeded", {
        p_stripe_payment_intent_id: intent.id,
        p_receipt_url: receipt,
        p_method: method,
      });
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const reason = intent.last_payment_error?.message ?? "Payment failed";
      await admin.rpc("apply_payment_failed", {
        p_stripe_payment_intent_id: intent.id,
        p_reason: reason,
      });
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const intentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null;
      if (intentId) {
        const latestRefund = charge.refunds?.data?.[0];
        await admin.rpc("apply_refund_succeeded", {
          p_stripe_payment_intent_id: intentId,
          p_stripe_refund_id: latestRefund?.id ?? null,
          p_amount: (charge.amount_refunded ?? 0) / 100,
          p_full: charge.amount_refunded >= charge.amount,
        });
      }
      break;
    }
    default:
      break; // acknowledge unhandled events
  }

  return res.status(200).json({ received: true });
}
