import { requireSupabase } from "@shared/data/client"
import type { OrderStatus } from "@shared/lib/database.types"
import type { StaffOrderItemInput } from "../features/newOrder/orderCart"

export type StaffPlacedOrder = {
  orderId: string
  orderNumber: string
  status: OrderStatus
  subtotal: number
  tax: number
  total: number
  currency: string
  restaurantName: string
  tableNumber: string | null
  customerName: string
  createdAt: string
  paid: boolean
}

export type StaffOrderErrorCode =
  | "empty_cart"
  | "customer_name_required"
  | "invalid_item"
  | "invalid_quantity"
  | "invalid_modifier"
  | "modifier_required"
  | "modifier_selection_invalid"
  | "menu_item_unavailable"
  | "table_not_found"
  | "not_authorised"
  | "order_number_conflict"
  | "unknown"

const ERROR_MESSAGES: Record<StaffOrderErrorCode, string> = {
  empty_cart: "Add at least one item before sending the order.",
  customer_name_required: "Enter a name for the order.",
  invalid_item: "One of the items is no longer on the menu. Review the order and try again.",
  invalid_quantity: "One of the item quantities is invalid.",
  invalid_modifier: "One of the selected options is no longer available. Review the order and try again.",
  modifier_required: "Choose the required options for one of the items.",
  modifier_selection_invalid: "Review the selected options for one of the items.",
  menu_item_unavailable: "One of the items just sold out. Review the order and try again.",
  table_not_found: "That table is no longer available. Choose another table or counter order.",
  not_authorised: "You do not have permission to create orders for this restaurant.",
  order_number_conflict: "Could not create an order number. Please try again.",
  unknown: "Could not create the order. Please try again.",
}

const ERROR_CODES = Object.keys(ERROR_MESSAGES) as StaffOrderErrorCode[]

export class StaffOrderError extends Error {
  readonly code: StaffOrderErrorCode

  constructor(code: StaffOrderErrorCode, message?: string) {
    super(message ?? ERROR_MESSAGES[code])
    this.name = "StaffOrderError"
    this.code = code
  }
}

/** Map a Postgres/RPC error message onto a friendly staff-facing code. */
export function mapStaffOrderError(error: {
  message?: string | null
  details?: string | null
  hint?: string | null
}): StaffOrderError {
  const haystack = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const code = ERROR_CODES.find((candidate) => haystack.includes(candidate))
  return new StaffOrderError(code ?? "unknown")
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Pure mapper for the `staff_place_order` jsonb result. */
export function mapStaffPlacedOrder(raw: unknown): StaffPlacedOrder | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  if (typeof row.order_id !== "string" || typeof row.order_number !== "string") {
    return null
  }

  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    status: (row.status as OrderStatus) ?? "confirmed",
    subtotal: num(row.subtotal),
    tax: num(row.tax),
    total: num(row.total),
    currency: typeof row.currency === "string" ? row.currency : "AUD",
    restaurantName:
      typeof row.restaurant_name === "string" ? row.restaurant_name : "",
    tableNumber:
      typeof row.table_number === "string" && row.table_number.length > 0
        ? row.table_number
        : null,
    customerName:
      typeof row.customer_name === "string" ? row.customer_name : "",
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString(),
    paid: row.paid === true,
  }
}

export async function createStaffOrder(input: {
  tableId: string | null
  customerName: string
  notes?: string
  items: StaffOrderItemInput[]
  paid: boolean
}): Promise<StaffPlacedOrder> {
  const client = requireSupabase()
  const customerName = input.customerName.trim()
  if (!customerName) throw new StaffOrderError("customer_name_required")
  if (input.items.length === 0) throw new StaffOrderError("empty_cart")

  const { data, error } = await client.rpc("staff_place_order", {
    p_table_id: input.tableId,
    p_customer_name: customerName,
    p_notes: input.notes?.trim() || null,
    p_items: input.items,
    p_paid: input.paid,
  })

  if (error) {
    console.error("staff_place_order failed", error)
    throw mapStaffOrderError(error)
  }

  const order = mapStaffPlacedOrder(data)
  if (!order) throw new StaffOrderError("unknown")
  return order
}
