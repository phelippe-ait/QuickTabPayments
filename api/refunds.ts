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

type PaymentRow = {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  stripe_payment_intent_id: string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  unit_price_snapshot: number;
  quantity: number;
};

function parseBody(req: VercelRequest): Body {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body) as Body;
  return req.body as Body;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
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

    // The payment must exist AND belong to this order (cross-order refunds are
    // refused before Stripe is touched).
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("id, order_id, amount, status, stripe_payment_intent_id")
      .eq("id", paymentId)
      .eq("order_id", orderId)
      .maybeSingle();
    if (paymentError) return json(res, 500, { error: paymentError.message });

    const paymentRow = payment as PaymentRow | null;
    if (!paymentRow?.stripe_payment_intent_id) {
      return json(res, 400, { error: "no_stripe_payment" });
    }
    if (paymentRow.status !== "succeeded") {
      return json(res, 400, { error: "payment_not_refundable" });
    }

    const refundAmount = roundMoney(Number(amount));
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      return json(res, 400, { error: "invalid_amount" });
    }

    // Line refunds are priced by the order snapshot, exactly like the
    // guard_refund_quantity() DB trigger. Validating here avoids refunding at
    // Stripe and only then failing the row insert.
    const hasLine = Boolean(orderItemId);
    const hasQuantity = quantity !== null && quantity !== undefined;
    if (hasLine !== hasQuantity) {
      return json(res, 400, { error: "invalid_request" });
    }

    if (hasLine) {
      const { data: line, error: lineError } = await admin
        .from("order_items")
        .select("id, order_id, unit_price_snapshot, quantity")
        .eq("id", orderItemId)
        .eq("order_id", orderId)
        .maybeSingle();
      if (lineError) return json(res, 500, { error: lineError.message });

      const lineRow = line as OrderItemRow | null;
      if (!lineRow) return json(res, 400, { error: "invalid_line_item" });

      const lineQuantity = Number(quantity);
      if (
        !Number.isInteger(lineQuantity) ||
        lineQuantity <= 0 ||
        lineQuantity > lineRow.quantity
      ) {
        return json(res, 400, { error: "invalid_quantity" });
      }

      const expected = roundMoney(Number(lineRow.unit_price_snapshot) * lineQuantity);
      if (refundAmount !== expected) {
        return json(res, 400, { error: "amount_mismatch" });
      }
    }

    // Never refund more than the payment's remaining balance. The DB trigger
    // enforces this too, but only after Stripe has already moved the money.
    const { data: existingRefunds, error: refundsError } = await admin
      .from("refunds")
      .select("amount")
      .eq("payment_id", paymentId)
      .eq("status", "succeeded");
    if (refundsError) return json(res, 500, { error: refundsError.message });

    const alreadyRefunded = roundMoney(
      (existingRefunds ?? []).reduce(
        (sum: number, row: { amount: number }) => sum + Number(row.amount),
        0,
      ),
    );
    if (alreadyRefunded + refundAmount > roundMoney(Number(paymentRow.amount))) {
      return json(res, 400, { error: "refund_exceeds_balance" });
    }

    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: paymentRow.stripe_payment_intent_id,
      amount: Math.round(refundAmount * 100),
      metadata: { orderId, paymentId, createdBy: user.id },
    });

    const { data: row, error: insertError } = await admin
      .from("refunds")
      .insert({
        order_id: orderId,
        payment_id: paymentId,
        order_item_id: orderItemId ?? null,
        quantity: quantity ?? null,
        amount: refundAmount,
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
