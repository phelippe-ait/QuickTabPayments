
import { supabase } from "../../../shared/lib/supabase"

export type StaffOrderRow = {
  id: string
  order_number: string
  status: string
  total: number
  created_at: string
  table_id: string | null
  restaurant_id: string
  order_items: {
    item_name_snapshot: string
    quantity: number
    unit_price_snapshot: number
    notes: string | null
  }[]
  tables: {
  table_number: string
} | null
}

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
tables (
  table_number
),
order_items (
        item_name_snapshot,
        quantity,
        unit_price_snapshot,
        notes
      )
    `)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as StaffOrderRow[]
}


import type { KitchenStatus, Order } from "../types"

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

  return {
    id: row.order_number,
    table: row.tables
  ? `Table ${row.tables.table_number}`
  : "No table",
    guest: "Customer",
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
    server: "QuickTab",
    guests: 1,
    payment: "Not confirmed",
    items: row.order_items.map((item) => ({
      name: item.item_name_snapshot,
      qty: item.quantity,
      price: item.unit_price_snapshot,
    })),
  }
}


export async function fetchMyStaffRestaurantId(): Promise<string | null> {
  if (!supabase) {
    throw new Error("Supabase is not configured")
  }

  const { data: userData, error: authError } =
    await supabase.auth.getUser()

  if (authError) {
    throw new Error(authError.message)
  }

  if (!userData.user) {
    return null
  }

  const { data, error } = await supabase
    .from("restaurant_staff")
    .select("restaurant_id")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const staffRestaurant = data as { restaurant_id: string } | null

return staffRestaurant?.restaurant_id ?? null
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
