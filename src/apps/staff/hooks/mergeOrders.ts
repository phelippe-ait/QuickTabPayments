import type { Order } from "../types"

/**
 * Merge a board fetch over the last-known orders.
 *
 * The fetch is authoritative for every order it returns, but previously seen
 * orders are kept as a floor so a reconnect (or a narrower fetch) never makes
 * the board flash empty. Matching is by board id (`order_number`), so an order
 * can appear at most once and re-syncing never re-adds an existing card.
 *
 * New-order detection is deliberately not part of this helper: the workspace
 * feeds only the freshly fetched rows to `useNewOrders.observe`, so re-merging
 * last-known data cannot re-mark an already seen order as new.
 */
export function mergeOrders(
  existing: readonly Order[],
  fetched: readonly Order[],
): Order[] {
  const merged = new Map<string, Order>()

  for (const order of existing) {
    if (!merged.has(order.id)) merged.set(order.id, order)
  }
  for (const order of fetched) {
    merged.set(order.id, order)
  }

  return [...merged.values()]
}
