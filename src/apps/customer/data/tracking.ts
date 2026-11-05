import { requireSupabase } from "@shared/data/client"
import type {
  OrderStatus,
  PaymentMethodType,
  PaymentStatus,
} from "@shared/lib/database.types"

export type TrackingOrderItem = {
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export type TrackingOrder = {
  orderId: string
  orderNumber: string
  status: OrderStatus
  subtotal: number
  tax: number
  total: number
  currency: string
  createdAt: string
  tableNumber: string | null
  restaurantName: string
  items: TrackingOrderItem[]
  paymentStatus: PaymentStatus | null
  paymentMethodType: PaymentMethodType | null
  receiptUrl: string | null
  amountPaid: number
  refundedTotal: number
}

/** Guests cannot receive RLS-filtered Realtime rows, so they poll. */
export const TRACKING_POLL_INTERVAL_MS = 7_000

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function mapTracking(raw: unknown): TrackingOrder | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  if (typeof row.order_id !== "string" || typeof row.order_number !== "string") {
    return null
  }

  const items = Array.isArray(row.items)
    ? row.items.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return []
        const line = entry as Record<string, unknown>
        if (typeof line.name !== "string") return []
        return [
          {
            name: line.name,
            quantity: num(line.quantity),
            unitPrice: num(line.unit_price),
            subtotal: num(line.subtotal),
          },
        ]
      })
    : []

  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    status: (row.status as OrderStatus) ?? "pending",
    subtotal: num(row.subtotal),
    tax: num(row.tax),
    total: num(row.total),
    currency: typeof row.currency === "string" ? row.currency : "AUD",
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    tableNumber:
      typeof row.table_number === "string" ? row.table_number : null,
    restaurantName:
      typeof row.restaurant_name === "string" ? row.restaurant_name : "",
    paymentStatus:
      typeof row.payment_status === "string"
        ? (row.payment_status as PaymentStatus)
        : null,
    paymentMethodType:
      typeof row.payment_method_type === "string"
        ? (row.payment_method_type as PaymentMethodType)
        : null,
    receiptUrl: typeof row.receipt_url === "string" ? row.receipt_url : null,
    amountPaid: num(row.amount_paid),
    refundedTotal: num(row.refunded_total),
    items,
  }
}

export async function fetchOrderTracking(
  token: string,
): Promise<TrackingOrder | null> {
  if (!token.trim()) return null
  const client = requireSupabase()
  const { data, error } = await client.rpc("get_order_tracking", {
    p_token: token.trim(),
  })

  if (error) {
    console.error("get_order_tracking failed", error)
    throw new Error("Could not load this order. Please try again.")
  }

  return mapTracking(data)
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return status === "completed" || status === "cancelled"
}

export function trackingUrl(
  orderNumber: string,
  trackingToken: string,
  origin: string = window.location.origin,
): string {
  const url = new URL(`/order/${encodeURIComponent(orderNumber)}`, origin)
  url.searchParams.set("token", trackingToken)
  return `${url.pathname}${url.search}`
}

export type RedirectStatus = "succeeded" | "failed" | "requires_action";

/**
 * Stripe appends `redirect_status` to the return URL after a redirect-based
 * payment method (3-D Secure, wallets). The webhook remains the source of
 * truth; this only decides which interim copy to show.
 */
export function parseRedirectStatus(
  value: string | URLSearchParams | null | undefined,
): RedirectStatus | null {
  const raw =
    typeof value === "string" || value == null
      ? value
      : value.get("redirect_status");
  return raw === "succeeded" || raw === "failed" || raw === "requires_action"
    ? raw
    : null;
}
