import { requireSupabase } from "@shared/data/client"
import type { OrderStatus } from "@shared/lib/database.types"

export type CustomerOrderItem = {
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export type CustomerOrder = {
  id: string
  orderNumber: string
  status: OrderStatus
  subtotal: number
  tax: number
  total: number
  currency: string
  restaurantName: string
  tableNumber: string | null
  trackingToken: string
  createdAt: string
  items: CustomerOrderItem[]
}

type HistoryRow = {
  id: string
  order_number: string
  status: OrderStatus
  subtotal: number
  tax: number
  total: number
  tracking_token: string
  created_at: string
  tables: { table_number: string } | null
  restaurants: { name: string; currency: string } | null
  order_items: Array<{
    item_name_snapshot: string
    quantity: number
    unit_price_snapshot: number
    subtotal: number
  }>
}

const historySelect = `
  id,
  order_number,
  status,
  subtotal,
  tax,
  total,
  tracking_token,
  created_at,
  tables(table_number),
  restaurants(name, currency),
  order_items(item_name_snapshot, quantity, unit_price_snapshot, subtotal)
`

/** Pure mapper so history rendering can be tested without Supabase. */
export function mapCustomerOrders(rows: HistoryRow[]): CustomerOrder[] {
  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    currency: row.restaurants?.currency ?? "AUD",
    restaurantName: row.restaurants?.name ?? "",
    tableNumber: row.tables?.table_number ?? null,
    trackingToken: row.tracking_token,
    createdAt: row.created_at,
    items: (row.order_items ?? []).map((item) => ({
      name: item.item_name_snapshot,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price_snapshot),
      subtotal: Number(item.subtotal),
    })),
  }))
}

/**
 * Customer order history reads `order_items` (authoritative), never the old
 * JSON-in-notes convention.
 */
export async function getCustomerOrderHistory(
  customerId: string,
): Promise<CustomerOrder[]> {
  const client = requireSupabase()

  const { data, error } = await client
    .from("orders")
    .select(historySelect)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Could not load customer order history", error)
    throw new Error("Could not load your order history. Please try again.")
  }

  return mapCustomerOrders((data ?? []) as unknown as HistoryRow[])
}
