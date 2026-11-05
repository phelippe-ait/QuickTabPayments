import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import { getStripe } from "./_lib/stripe.js";
import { adminClient } from "./_lib/supabaseAdmin.js";
import { bearer, json } from "./_lib/http.js";

type Body = {
  orderId?: string;
  paymentId?: string;
  amount?: number;
  reason?: string;
  orderItemId?: string | null;
  quantity?: number | null;
};

function parseBody(req: VercelRequest): Body {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body) as Body;
  return req.body as Body;
}

function mapRefundStatus(status: Stripe.Refund["status"]): string {
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  return "requested";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const token = bearer(req);
    if (!token) return json(res, 401, { error: "unauthorized" });

    const admin = adminClient();
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user) return json(res, 401, { error: "unauthorized" });

    const { orderId, paymentId, amount, reason, orderItemId, quantity } =
      parseBody(req);
    if (!orderId || !paymentId || !Number.isFinite(Number(amount))) {
      return json(res, 400, { error: "invalid_request" });
    }

    // Never trust a client role claim: verify membership server-side.
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, restaurant_id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError || !order) return json(res, 404, { error: "order_not_found" });

    const { data: staff, error: staffError } = await admin
      .from("restaurant_staff")
      .select("role, is_active")
      .eq("user_id", user.id)
      .eq("restaurant_id", order.restaurant_id)
      .maybeSingle();
    if (staffError) return json(res, 500, { error: staffError.message });
    if (
      !staff ||
      !staff.is_active ||
      (staff.role !== "owner" && staff.role !== "manager")
    ) {
      return json(res, 403, { error: "forbidden" });
    }

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("id, order_id, stripe_payment_intent_id")
      .eq("id", paymentId)
      .eq("order_id", orderId)
      .maybeSingle();
    if (paymentError) return json(res, 500, { error: paymentError.message });
    if (!payment?.stripe_payment_intent_id) {
      return json(res, 400, { error: "no_stripe_payment" });
    }

    const refundAmount = Math.round(Number(amount) * 100);
    if (refundAmount <= 0) return json(res, 400, { error: "invalid_amount" });

    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      amount: refundAmount,
      metadata: { orderId, paymentId, createdBy: user.id },
    });

    const { data: row, error: insertError } = await admin
      .from("refunds")
      .insert({
        order_id: orderId,
        payment_id: paymentId,
        order_item_id: orderItemId ?? null,
        quantity: quantity ?? null,
        amount: Number(amount),
        reason: reason ?? null,
        status: mapRefundStatus(refund.status),
        stripe_refund_id: refund.id,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertError) {
      // Stripe already refunded; surface the DB guard error for reconciliation.
      console.error("Stripe refund succeeded but refund row insert failed", {
        refundId: refund.id,
        error: insertError,
      });
      return json(res, 500, { error: insertError.message });
    }

    return json(res, 200, row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return json(res, 500, { error: message });
  }
}
