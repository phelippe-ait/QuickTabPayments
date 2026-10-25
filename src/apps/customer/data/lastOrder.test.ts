import { beforeEach, describe, expect, it } from "vitest"
import {
  clearLastOrder,
  lastOrderStorageKey,
  readLastOrder,
  saveLastOrder,
} from "./lastOrder"
import type { PlacedOrder } from "./placeOrder"

const source = { slug: "quicktab-demo-cafe", tableToken: "table-a" }

const order: PlacedOrder = {
  orderId: "order-1",
  orderNumber: "QT-261025-0001",
  trackingToken: "token-1",
  status: "confirmed",
  subtotal: 4.27,
  tax: 0.43,
  total: 4.7,
  currency: "AUD",
  restaurantName: "QuickTab Demo Cafe",
  tableNumber: "T05",
  customerName: "Olivia",
  createdAt: "2026-10-25T02:00:00Z",
  paymentMethod: "google_pay",
  items: [{ name: "Flat White", quantity: 1, unitPrice: 4.7, subtotal: 4.7 }],
}

describe("last order persistence", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("restores the confirmation after a reload", () => {
    saveLastOrder(source, order)
    expect(readLastOrder(source)).toEqual(order)
  })

  it("scopes the last order to restaurant + table", () => {
    saveLastOrder(source, order)
    expect(
      readLastOrder({ slug: "quicktab-demo-cafe", tableToken: "table-b" }),
    ).toBeNull()
  })

  it("clears the confirmation once dismissed", () => {
    saveLastOrder(source, order)
    clearLastOrder(source)
    expect(window.sessionStorage.getItem(lastOrderStorageKey(source))).toBeNull()
  })

  it("ignores malformed storage", () => {
    window.sessionStorage.setItem(lastOrderStorageKey(source), "{bad")
    expect(readLastOrder(source)).toBeNull()
  })

  it("drops an unknown payment method but keeps the order", () => {
    window.sessionStorage.setItem(
      lastOrderStorageKey(source),
      JSON.stringify({ ...order, paymentMethod: "crypto" }),
    )
    expect(readLastOrder(source)?.paymentMethod).toBeUndefined()
    expect(readLastOrder(source)?.orderNumber).toBe(order.orderNumber)
  })
})
