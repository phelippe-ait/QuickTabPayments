import { requireSupabase } from "./client";
import type {
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  TablesUpdate,
} from "@shared/lib/database.types";

export type OrderCustomer = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type OpenTableOrder = {
  orderId: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
}

type OpenOrderRow = Pick<
  Order,
  "id" | "table_id" | "order_number" | "status" | "created_at"
>

/**
 * One open order per table (the latest by `created_at`). Kept pure so the
 * latest-per-table rule can be unit-tested without Supabase.
 */
export function reduceOpenOrdersByTable(
  rows: OpenOrderRow[],
): Record<string, OpenTableOrder> {
  const byTable: Record<string, OpenTableOrder> = {}

  for (const row of rows) {
    if (!row.table_id) continue
    const current = byTable[row.table_id]
    if (current && current.createdAt >= row.created_at) continue
    byTable[row.table_id] = {
      orderId: row.id,
      orderNumber: row.order_number,
      status: row.status,
      createdAt: row.created_at,
    }
  }

  return byTable
}

export type OrderWithDetails = Order & {
  order_items: OrderItem[];
  payments: Payment[];
  tables: { table_number: string } | null;
  profiles: OrderCustomer | null;
};

const orderSelect = `
  *,
  order_items(*),
  payments(*),
  tables(table_number),
  profiles(first_name, last_name, email)
`;

export async function fetchOrders(
  restaurantId: string,
  options: { limit?: number } = {},
): Promise<OrderWithDetails[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("orders")
    .select(orderSelect)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OrderWithDetails[];
}

export async function fetchOpenOrdersByTable(
  restaurantId: string,
): Promise<Record<string, OpenTableOrder>> {
  const client = requireSupabase()
  const { data, error } = await client
    .from("orders")
    .select("id, table_id, order_number, status, created_at")
    .eq("restaurant_id", restaurantId)
    .in("status", ["pending", "confirmed", "preparing", "ready"])
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return reduceOpenOrdersByTable(data ?? [])
}

export async function fetchOrder(id: string): Promise<OrderWithDetails> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("orders")
    .select(orderSelect)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as OrderWithDetails;
}

export async function updateOrder(
  id: string,
  patch: TablesUpdate<"orders">,
): Promise<Order> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("orders")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<Order> {
  return updateOrder(id, {
    status,
    completed_at:
      status === "completed" || status === "cancelled"
        ? new Date().toISOString()
        : null,
  });
}

export const orderKeys = {
  all: (restaurantId: string) => ["orders", restaurantId] as const,
  detail: (id: string) => ["orders", "detail", id] as const,
  openTables: (restaurantId: string) =>
    ["orders", restaurantId, "open-tables"] as const,
};
