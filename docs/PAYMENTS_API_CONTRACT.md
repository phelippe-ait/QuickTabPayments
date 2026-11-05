# Payments API contract (Phase 6)

Server runtime: Vercel Node functions under `/api`. Secrets stay server-side
(`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`).
Only `VITE_STRIPE_PUBLISHABLE_KEY` is bundled into the browser.

## `POST /api/create-payment-intent`

Creates a **pending** order as the caller (guests get `customer_id = null`),
records a pending `payments` row, and creates a Stripe PaymentIntent.

Request:

```json
{
  "restaurantSlug": "quicktab-demo-cafe",
  "tableToken": "<tables.qr_token>",
  "customerName": "Jane",
  "notes": "No sauce",
  "items": [{ "menu_item_id": "<uuid>", "quantity": 2 }]
}
```

Response `200`:

```json
{
  "clientSecret": "pi_..._secret_...",
  "orderId": "<uuid>",
  "orderNumber": "QT-260105-0001",
  "trackingToken": "<opaque hex>",
  "amount": 42.0,
  "currency": "AUD",
  "status": "pending"
}
```

Errors: `400 invalid_request`, `400 <place_order error>` (for example
`menu_item_unavailable`), `405`, `500 could_not_record_payment`.

Amounts are recomputed by `place_order`; Stripe receives
`Math.round(amount * 100)` minor units and a lowercase currency.

## `POST /api/refunds`

Requires `Authorization: Bearer <supabase access token>` from an active
`owner`/`manager` of the order's restaurant. Calls Stripe, then writes the
`refunds` row including `stripe_refund_id`.

Request: `{ orderId, paymentId, amount, reason, orderItemId?, quantity? }`

Response `200`: the created `refunds` row.

Errors: `401 unauthorized`, `403 forbidden`, `404 order_not_found`,
`400 no_stripe_payment`, `400 invalid_amount`, `405`.

## `POST /api/webhooks/stripe`

Signature-verified with `STRIPE_WEBHOOK_SECRET`; raw request bytes are used.
Unhandled events return `200` so Stripe stops retrying.

| Event | Effect |
|---|---|
| `payment_intent.succeeded` | payment → `succeeded` (+ `paid_at`, receipt, method); order `pending → confirmed` |
| `payment_intent.payment_failed` | payment → `failed` (+ reason); order `pending → cancelled` |
| `charge.refunded` | matching refund → `succeeded`; payment → `refunded` only when fully refunded |

Redelivery is a no-op because the RPCs guard on the current status. Partial
refunds leave the payment `succeeded` and are represented by `refunds` rows;
the customer UI labels them **Partially refunded**.

The four payment RPCs (`record_payment_intent`, `apply_payment_succeeded`,
`apply_payment_failed`, `apply_refund_succeeded`) are **service-role only**.
`0018_phase6_rpc_lockdown.sql` explicitly revokes them from `public`, `anon`
and `authenticated`; calling them with the anon key returns `401 / 42501`.

## Customer tracking payload

`get_order_tracking(token)` is token-authorised and returns payment details for
the tracking page:

```json
{
  "order_number": "QT-260105-0001",
  "status": "confirmed",
  "payment_status": "succeeded",
  "payment_method_type": "card",
  "receipt_url": "https://pay.stripe.com/receipts/...",
  "amount_paid": 42.0,
  "refunded_total": 10.0
}
```

`refunded_total > 0` with `payment_status = "succeeded"` means a partial refund;
`payment_status = "refunded"` means the charge was fully refunded.

## Status mapping

| Order | Payment | Meaning |
|---|---|---|
| `pending` | `pending` | Awaiting payment / webhook |
| `confirmed` | `succeeded` | Paid; visible to the kitchen |
| `cancelled` | `failed` | Payment failed; order closed |

`link` and unknown methods map to the DB enum `other`. The kitchen board
excludes `pending` orders entirely.
