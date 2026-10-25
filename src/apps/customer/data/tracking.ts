import { requireSupabase } from "@shared/data/client"
import type { OrderStatus } from "@shared/lib/database.types"

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
  pickupTimeEstimate: string | null
  tableNumber: string | null
  restaurantName: string
  items: TrackingOrderItem[]
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
    pickupTimeEstimate:
      typeof row.pickup_time_estimate === "string"
        ? row.pickup_time_estimate
        : null,
    tableNumber:
      typeof row.table_number === "string" ? row.table_number : null,
    restaurantName:
      typeof row.restaurant_name === "string" ? row.restaurant_name : "",
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
