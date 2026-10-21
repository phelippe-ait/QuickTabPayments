import { requireSupabase } from "./client";
import type {
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  TablesUpdate,
} from "@shared/lib/database.types";

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

export type OrderItemWithImage = OrderItem & {
  menu_items: { image_url: string | null } | null;
};

export type OrderWithDetails = Order & {
  order_items: OrderItemWithImage[];
  payments: Payment[];
  tables: { table_number: string } | null;
};

export type OrderFilters = {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  from?: string;
  to?: string;
  search?: string;
};

export type OrderPage = {
  rows: OrderWithDetails[];
  count: number;
};

export type DailyStatsRow = {
  period: string;
  orders_count: number;
  revenue: number;
  avg_order_value: number;
};

/** PostgREST `or` filters treat commas/parentheses as syntax: strip them. */
export function sanitiseOrderSearch(value: string): string {
  return value.replace(/[(),%]/g, " ").trim();
}

const orderSelect = `
  *,
  order_items(*, menu_items(image_url)),
  payments(*),
  tables(table_number)
`;

export async function fetchOrders(
  restaurantId: string,
  options: OrderFilters = {},
): Promise<OrderPage> {
  const client = requireSupabase();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
  const from = (page - 1) * pageSize;

  let query = client
    .from("orders")
    .select(orderSelect, { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (options.status) query = query.eq("status", options.status);
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lte("created_at", options.to);

  const search = options.search ? sanitiseOrderSearch(options.search) : "";
  if (search) {
    query = query.or(
      `order_number.ilike.%${search}%,customer_name_snapshot.ilike.%${search}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as unknown as OrderWithDetails[],
    count: count ?? 0,
  };
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

/**
 * `completed_at` is "closed at": set for both completed and cancelled. It is
 * cleared when a transition moves back into an open state (not currently
 * possible through the status matrix, but safe if a future flow reopens one).
 */
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

export async function fetchOrderStats(
  restaurantId: string,
  timezone: string,
): Promise<DailyStatsRow[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("restaurant_daily_stats", {
    p_restaurant_id: restaurantId,
    p_timezone: timezone,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as DailyStatsRow[];
}

export const orderKeys = {
  all: (restaurantId: string) => ["orders", restaurantId] as const,
  list: (restaurantId: string, filters: OrderFilters) =>
    ["orders", restaurantId, "list", filters] as const,
  detail: (id: string) => ["orders", "detail", id] as const,
  stats: (restaurantId: string) =>
    ["orders", restaurantId, "stats"] as const,
  openTables: (restaurantId: string) =>
    ["orders", restaurantId, "open-tables"] as const,
};
