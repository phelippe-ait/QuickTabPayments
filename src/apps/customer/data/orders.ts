import { requireSupabase } from "@shared/data/client"
import type {
  OrderStatus,
  PaymentStatus,
  RefundStatus,
} from "@shared/lib/database.types"

export type CustomerOrderItem = {
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
  modifiers?: { name: string; priceAdjustment: number }[]
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
  paymentStatus: PaymentStatus | null
  receiptUrl: string | null
  refundedTotal: number
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
    order_item_modifiers?: Array<{
      modifier_name_snapshot: string
      price_adjustment_snapshot: number
    }>
  }>
  payments: Array<{
    status: PaymentStatus
    payment_method_type: string | null
    amount: number
    receipt_url: string | null
  }>
  refunds: Array<{
    amount: number
    status: RefundStatus
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
  order_items(item_name_snapshot, quantity, unit_price_snapshot, subtotal, order_item_modifiers(modifier_name_snapshot, price_adjustment_snapshot)),
  payments(status, payment_method_type, amount, receipt_url),
  refunds(amount, status)
`

/** Pure mapper so history rendering can be tested without Supabase. */
export function mapCustomerOrders(rows: HistoryRow[]): CustomerOrder[] {
  return rows.map((row) => {
    const payment =
      row.payments?.find(
        (entry) => entry.status === "succeeded" || entry.status === "refunded",
      ) ?? row.payments?.[0]
    const refundedTotal = (row.refunds ?? [])
      .filter((refund) => refund.status === "succeeded")
      .reduce((total, refund) => total + Number(refund.amount), 0)

    return {
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
      paymentStatus: payment?.status ?? null,
      receiptUrl: payment?.receipt_url ?? null,
      refundedTotal,
      items: (row.order_items ?? []).map((item) => ({
        name: item.item_name_snapshot,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price_snapshot),
        subtotal: Number(item.subtotal),
        ...((item.order_item_modifiers?.length ?? 0) > 0
          ? { modifiers: item.order_item_modifiers!.map((modifier) => ({
              name: modifier.modifier_name_snapshot,
              priceAdjustment: Number(modifier.price_adjustment_snapshot),
            })) }
          : {}),
      })),
    }
  })
}

/**
 * Attach an unclaimed guest order to the signed-in customer. Possession of the
 * opaque tracking token authorises the claim; the RPC refuses cancelled orders
 * and orders that already belong to someone.
 */
export async function claimGuestOrder(trackingToken: string): Promise<boolean> {
  if (!trackingToken.trim()) return false;
  const client = requireSupabase();
  const { data, error } = await client.rpc("claim_guest_order", {
    p_tracking_token: trackingToken.trim(),
  });

  if (error) {
    console.error("claim_guest_order failed", error);
    return false;
  }

  return Boolean(data);
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
