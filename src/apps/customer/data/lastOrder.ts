import { isSimulatedPaymentMethod } from "../types"
import type { PlacedOrder } from "./placeOrder"
import type { QrSource } from "./qrContext"

/**
 * The "last order" is kept per restaurant + table so a reload (or an OAuth
 * redirect) can restore the confirmation screen for a guest without exposing
 * anyone else's order.
 */
export function lastOrderStorageKey(source: QrSource): string {
  return `quicktab:last-order:${source.slug}:${source.tableToken}`
}

export function saveLastOrder(source: QrSource, order: PlacedOrder): void {
  try {
    window.sessionStorage.setItem(
      lastOrderStorageKey(source),
      JSON.stringify(order),
    )
  } catch {
    // Storage may be unavailable in private mode; the in-memory state still works.
  }
}

export function readLastOrder(source: QrSource): PlacedOrder | null {
  try {
    const raw = window.sessionStorage.getItem(lastOrderStorageKey(source))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const row = parsed as Record<string, unknown>
    if (
      typeof row.orderId !== "string" ||
      typeof row.orderNumber !== "string" ||
      typeof row.trackingToken !== "string"
    ) {
      return null
    }
    return {
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      trackingToken: row.trackingToken,
      status: (row.status as PlacedOrder["status"]) ?? "confirmed",
      subtotal: Number(row.subtotal ?? 0),
      tax: Number(row.tax ?? 0),
      total: Number(row.total ?? 0),
      currency: typeof row.currency === "string" ? row.currency : "AUD",
      restaurantName:
        typeof row.restaurantName === "string" ? row.restaurantName : "",
      tableNumber:
        typeof row.tableNumber === "string" ? row.tableNumber : "",
      customerName:
        typeof row.customerName === "string" ? row.customerName : "",
      createdAt:
        typeof row.createdAt === "string" ? row.createdAt : "",
      paymentMethod: isSimulatedPaymentMethod(row.paymentMethod)
        ? row.paymentMethod
        : undefined,
      items: Array.isArray(row.items)
        ? row.items.flatMap((entry) => {
            if (!entry || typeof entry !== "object") return []
            const line = entry as Record<string, unknown>
            if (typeof line.name !== "string") return []
            return [
              {
                name: line.name,
                quantity: Number(line.quantity ?? 0),
                unitPrice: Number(line.unitPrice ?? 0),
                subtotal: Number(line.subtotal ?? 0),
              },
            ]
          })
        : [],
    }
  } catch {
    return null
  }
}

export function clearLastOrder(source: QrSource): void {
  try {
    window.sessionStorage.removeItem(lastOrderStorageKey(source))
  } catch {
    // ignore
  }
}
