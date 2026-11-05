import { supabase } from "../../../shared/lib/supabase"
import type { PaymentStatus } from "@shared/lib/database.types"
import { paymentStatusLabel } from "@shared/orders/paymentLabels"
import type { KitchenStatus, Order } from "../types"

export type StaffOrderRow = {
  id: string
  order_number: string
  status: string
  total: number
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
  }[]
  payments: {
    status: PaymentStatus
    payment_method_type: string | null
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
        notes
      ),
      payments (
        status,
        payment_method_type
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

export function mapStaffOrder(row: StaffOrderRow): Order {
  const kitchenStatus = mapKitchenStatus(row.status)
  const latestPayment = row.payments?.[0]

  return {
    id: row.order_number,
    databaseId: row.id,
    table: row.tables ? `Table ${row.tables.table_number}` : "No table",
    guest: row.customer_name_snapshot || "Guest",
    time: new Date(row.created_at).toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    total: row.total,
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
    })),
  }
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
    throw new Error(error.message)
  }

  if (!data || data.length !== 1) {
    throw new Error(
      "Order was not updated. Check staff permissions and RLS policies.",
    )
  }
}
