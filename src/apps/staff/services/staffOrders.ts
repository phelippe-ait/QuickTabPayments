import { supabase } from "../../../shared/lib/supabase"
import { roundMoney } from "@shared/lib/money"
import type { OrderStatus, PaymentStatus } from "@shared/lib/database.types"
import { paymentStatusLabel } from "@shared/orders/paymentLabels"
import { selectLatestPayment } from "../data/latestPayment"
import {
  canTransitionStatus,
  nextStatuses,
} from "@shared/orders/status"
import type { KitchenStatus, Order } from "../types"

export type StaffOrderRow = {
  id: string
  order_number: string
  status: string
  total: number
  tip_amount?: number | null
  created_at: string
  table_id: string | null
  restaurant_id: string
  customer_name_snapshot: string | null
  tables: {
    table_number: string
  } | null
  order_items: {
    item_name_snapshot: string
    quantity: number
    unit_price_snapshot: number
    notes: string | null
    order_item_modifiers?: { modifier_name_snapshot: string }[]
    menu_items: { allergens: string[] } | null
  }[]
  payments: {
    status: PaymentStatus
    payment_method_type: string | null
    created_at?: string | null
  }[]
}

/**
 * Orders for the live kitchen board. `pending` orders are unpaid and must not
 * reach the kitchen; the Stripe webhook confirms them first.
 */
export async function fetchStaffOrders(restaurantId: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured")
  }

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      total,
      tip_amount,
      created_at,
      table_id,
      restaurant_id,
      customer_name_snapshot,
      tables (
        table_number
      ),
      order_items (
        item_name_snapshot,
        quantity,
        unit_price_snapshot,
        notes,
        order_item_modifiers (modifier_name_snapshot),
        menu_items (allergens)
      ),
      payments (
        status,
        payment_method_type,
        created_at
      )
    `)
    .eq("restaurant_id", restaurantId)
    .neq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as StaffOrderRow[]
}

function mapKitchenStatus(status: string): KitchenStatus {
  switch (status) {
    case "preparing":
      return "Preparing"
    case "ready":
      return "Ready"
    case "completed":
      return "Completed"
    case "cancelled":
      return "Cancelled"
    default:
      return "New"
  }
}

/**
 * The board's `New` column means an order is confirmed and waiting to be
 * started. `pending` orders never reach the board (the query filters them).
 */
export function kitchenStatusToOrderStatus(status: KitchenStatus): OrderStatus {
  switch (status) {
    case "Preparing":
      return "preparing"
    case "Ready":
      return "ready"
    case "Completed":
      return "completed"
    case "Cancelled":
      return "cancelled"
    default:
      return "confirmed"
  }
}

const orderStatusToKitchenStatus: Partial<Record<OrderStatus, KitchenStatus>> = {
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
}

/**
 * Legal next actions for a board card, derived from the shared transition
 * matrix so the UI can never offer a transition the P03 DB trigger rejects.
 */
export function nextKitchenActions(status: KitchenStatus): KitchenStatus[] {
  return nextStatuses(kitchenStatusToOrderStatus(status))
    .map((next) => orderStatusToKitchenStatus[next])
    .filter((next): next is KitchenStatus => next !== undefined)
}

export function canKitchenTransition(
  from: KitchenStatus,
  to: KitchenStatus,
): boolean {
  return canTransitionStatus(
    kitchenStatusToOrderStatus(from),
    kitchenStatusToOrderStatus(to),
  )
}

export function mapStaffOrder(row: StaffOrderRow): Order {
  const kitchenStatus = mapKitchenStatus(row.status)
  const latestPayment = selectLatestPayment(row.payments)
  const tipAmount = Number(row.tip_amount ?? 0)

  return {
    id: row.order_number,
    databaseId: row.id,
    table: row.tables ? `Table ${row.tables.table_number}` : "No table",
    guest: row.customer_name_snapshot || "Guest",
    createdAt: row.created_at,
    time: new Date(row.created_at).toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    total: row.total,
    tipAmount,
    amountDue: roundMoney(row.total + tipAmount),
    status:
      kitchenStatus === "Completed"
        ? "Completed"
        : kitchenStatus === "Cancelled"
          ? "Cancelled"
          : "In progress",
    kitchenStatus,
    server: "—",
    guests: 1,
    payment: latestPayment
      ? paymentStatusLabel(latestPayment.status)
      : "—",
    items: (row.order_items ?? []).map((item) => ({
      name: item.item_name_snapshot,
      qty: item.quantity,
      price: item.unit_price_snapshot,
      ...(item.order_item_modifiers?.length
        ? { modifiers: item.order_item_modifiers.map((modifier) => modifier.modifier_name_snapshot) }
        : {}),
      ...(item.menu_items?.allergens?.length
        ? { allergens: item.menu_items.allergens }
        : {}),
    })),
  }
}

const staffOrderErrorMessages: Record<string, string> = {
  invalid_status_transition:
    "That status change isn't allowed. Refresh the order and try again.",
}

/**
 * Maps database error codes to staff-facing copy. Unknown codes fall back to
 * the raw message so infrastructure/permission errors are still visible.
 */
export function mapStaffOrderError(message: string): string {
  return staffOrderErrorMessages[message] ?? message
}

export async function updateStaffOrderStatus(
  restaurantId: string,
  orderNumber: string,
  status: "preparing" | "ready" | "completed" | "cancelled",
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured")
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status } as never)
    .eq("restaurant_id", restaurantId)
    .eq("order_number", orderNumber)
    .select("id")

  if (error) {
    throw new Error(mapStaffOrderError(error.message))
  }

  if (!data || data.length !== 1) {
    throw new Error(
      "Order was not updated. Check staff permissions and RLS policies.",
    )
  }
}
