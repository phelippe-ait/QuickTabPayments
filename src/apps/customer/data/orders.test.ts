import { describe, expect, it } from "vitest"
import { mapCustomerOrders } from "./orders"

describe("mapCustomerOrders", () => {
  it("reads line items and tracking token from the order rows", () => {
    const orders = mapCustomerOrders([
      {
        id: "order-1",
        order_number: "QT-261025-0001",
        status: "preparing",
        subtotal: 4.27,
        tax: 0.43,
        total: 4.7,
        tracking_token: "token-1",
        created_at: "2026-10-25T02:00:00Z",
        tables: { table_number: "T05" },
        restaurants: { name: "QuickTab Demo Cafe", currency: "AUD" },
        order_items: [
          {
            item_name_snapshot: "Flat White",
            quantity: 1,
            unit_price_snapshot: 4.7,
            subtotal: 4.7,
          },
        ],
      },
    ])

    expect(orders[0]).toMatchObject({
      orderNumber: "QT-261025-0001",
      status: "preparing",
      tableNumber: "T05",
      restaurantName: "QuickTab Demo Cafe",
      trackingToken: "token-1",
      items: [
        { name: "Flat White", quantity: 1, unitPrice: 4.7, subtotal: 4.7 },
      ],
    })
  })

  it("tolerates missing joins without inventing data", () => {
    const orders = mapCustomerOrders([
      {
        id: "order-1",
        order_number: "1001",
        status: "completed",
        subtotal: 0,
        tax: 0,
        total: 0,
        tracking_token: "token-1",
        created_at: "2026-10-25T02:00:00Z",
        tables: null,
        restaurants: null,
        order_items: [],
      },
    ])

    expect(orders[0].tableNumber).toBeNull()
    expect(orders[0].currency).toBe("AUD")
    expect(orders[0].items).toEqual([])
  })
})
