import { requireSupabase } from "@shared/data/client"
import type { OrderStatus, PaymentStatus } from "@shared/lib/database.types"
import type { CartItem, SimulatedPaymentMethod } from "../types"

export type PlacedOrderItem = {
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
  modifiers?: { name: string; priceAdjustment: number }[]
}

export type PlacedOrder = {
  orderId: string
  orderNumber: string
  trackingToken: string
  status: OrderStatus
  subtotal: number
  tax: number
  total: number
  /** Tip added on top of the GST-inclusive total; no GST on the tip. */
  tipAmount?: number
  /** total + tipAmount — the amount actually charged. */
  amountDue?: number
  currency: string
  /** Restaurant GST rate, used for consistent labels after a reload. */
  taxRate?: number
  restaurantName: string
  tableNumber: string
  customerName: string
  createdAt: string
  items: PlacedOrderItem[]
  /** Client-only simulation metadata; not written to the database. */
  paymentMethod?: SimulatedPaymentMethod
  /** Real payment status from `payments`, when known. */
  paymentStatus?: PaymentStatus
  receiptUrl?: string | null
}

export type PlaceOrderErrorCode =
  | "empty_cart"
  | "customer_name_required"
  | "invalid_item"
  | "invalid_quantity"
  | "restaurant_not_found"
  | "table_not_found"
  | "menu_item_unavailable"
  | "invalid_modifier_selection"
  | "modifier_selection_invalid"
  | "modifier_required"
  | "invalid_modifier"
  | "customer_location_required"
  | "customer_location_invalid"
  | "outside_ordering_radius"
  | "restaurant_location_not_configured"
  | "order_number_conflict"
  | "unknown"

const ERROR_MESSAGES: Record<PlaceOrderErrorCode, string> = {
  empty_cart: "Your cart is empty.",
  customer_name_required: "Please enter a name for the order.",
  invalid_item:
    "One of your items is no longer on the menu. Please review your cart.",
  invalid_quantity: "One of your item quantities is invalid.",
  restaurant_not_found:
    "This restaurant is no longer accepting orders. Please ask a team member for help.",
  table_not_found:
    "This table QR code is no longer valid. Please scan the QR code on your table again.",
  menu_item_unavailable:
    "One of your items just sold out. Please review your cart and try again.",
  invalid_modifier_selection: "Please review the required options for your item and try again.",
  modifier_selection_invalid: "Please review the options selected for your item and try again.",
  modifier_required: "Please choose the required options for your item.",
  invalid_modifier: "One of the selected options is no longer available. Please review your item.",
  customer_location_required:
    "Allow location access to confirm you are within 500 m of the restaurant, then try again.",
  customer_location_invalid:
    "We couldn't verify your location. Please try again.",
  outside_ordering_radius:
    "You need to be within 500 m of the restaurant to place an order.",
  restaurant_location_not_configured:
    "This restaurant hasn't set its ordering location yet. Please ask the restaurant team for help.",
  order_number_conflict:
    "We couldn't create an order number. Please try again in a moment.",
  unknown: "We couldn't place your order. Please try again.",
}

const ERROR_CODES = Object.keys(ERROR_MESSAGES) as PlaceOrderErrorCode[]

export class PlaceOrderError extends Error {
  readonly code: PlaceOrderErrorCode

  constructor(code: PlaceOrderErrorCode, message?: string) {
    super(message ?? ERROR_MESSAGES[code])
    this.name = "PlaceOrderError"
    this.code = code
  }
}

/** Map a Postgres/RPC error message onto a user-facing code + message. */
export function mapPlaceOrderError(error: {
  message?: string | null
  details?: string | null
  hint?: string | null
}): PlaceOrderError {
  const haystack = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const code = ERROR_CODES.find((candidate) => haystack.includes(candidate))
  return new PlaceOrderError(code ?? "unknown")
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Pure mapper for the `place_order` jsonb result. */
export function mapPlacedOrder(raw: unknown): PlacedOrder | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  if (typeof row.order_id !== "string" || typeof row.order_number !== "string") {
    return null
  }
  if (typeof row.tracking_token !== "string") return null

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
            ...(Array.isArray(line.modifiers) && line.modifiers.length > 0
              ? { modifiers: line.modifiers.flatMap((modifier) => {
                  if (!modifier || typeof modifier !== "object") return []
                  const selected = modifier as Record<string, unknown>
                  if (typeof selected.name !== "string") return []
                  return [{ name: selected.name, priceAdjustment: num(selected.price_adjustment) }]
                }) }
              : {}),
          },
        ]
      })
    : []

  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    trackingToken: row.tracking_token,
    status: (row.status as OrderStatus) ?? "pending",
    subtotal: num(row.subtotal),
    tax: num(row.tax),
    total: num(row.total),
    ...(row.tip_amount != null ? { tipAmount: num(row.tip_amount) } : {}),
    ...(row.amount_due != null ? { amountDue: num(row.amount_due) } : {}),
    currency: typeof row.currency === "string" ? row.currency : "AUD",
    restaurantName:
      typeof row.restaurant_name === "string" ? row.restaurant_name : "",
    tableNumber: typeof row.table_number === "string" ? row.table_number : "",
    customerName:
      typeof row.customer_name === "string" ? row.customer_name : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    items,
  }
}

export async function placeOrder(input: {
  restaurantSlug: string
  tableToken: string
  customerName: string
  notes?: string
  items: CartItem[]
  location?: { latitude: number; longitude: number }
}): Promise<PlacedOrder> {
  const client = requireSupabase()

  // Only item/modifier ids + quantities cross the wire. The server prices the order.
  const items = input.items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      menu_item_id: item.menuItemId,
      quantity: Math.trunc(item.quantity),
      ...((item.modifiers?.length ?? 0) > 0
        ? { modifiers: item.modifiers!.map((modifier) => modifier.id) }
        : {}),
    }))

  if (items.length === 0) throw new PlaceOrderError("empty_cart")

  const { data, error } = await client.rpc("place_order", {
    p_restaurant_slug: input.restaurantSlug,
    p_table_token: input.tableToken,
    p_customer_name: input.customerName.trim(),
    p_notes: input.notes?.trim() || null,
    p_items: items,
    ...(input.location
      ? {
          p_customer_latitude: input.location.latitude,
          p_customer_longitude: input.location.longitude,
        }
      : {}),
  })

  if (error) {
    console.error("place_order failed", error)
    throw mapPlaceOrderError(error)
  }

  const order = mapPlacedOrder(data)
  if (!order) throw new PlaceOrderError("unknown")
  return { ...order, customerName: input.customerName.trim() }
}
