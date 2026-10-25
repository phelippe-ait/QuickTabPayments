import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  mapPlaceOrderError,
  mapPlacedOrder,
  placeOrder,
  PlaceOrderError,
} from "./placeOrder"

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@shared/data/client", () => ({
  requireSupabase: () => ({ rpc: mocks.rpc }),
}))

const rpcResult = {
  order_id: "order-1",
  order_number: "QT-261025-0001",
  tracking_token: "tracking-1",
  status: "confirmed",
  subtotal: 4.27,
  tax: 0.43,
  total: 4.7,
  currency: "AUD",
  restaurant_name: "QuickTab Demo Cafe",
  table_number: "T05",
  pickup_time_estimate: "2026-10-25T02:10:00Z",
  created_at: "2026-10-25T02:00:00Z",
  items: [
    { name: "Flat White", quantity: 1, unit_price: 4.7, subtotal: 4.7 },
  ],
}

describe("mapPlacedOrder", () => {
  it("maps the RPC jsonb result", () => {
    expect(mapPlacedOrder(rpcResult)).toMatchObject({
      orderId: "order-1",
      orderNumber: "QT-261025-0001",
      trackingToken: "tracking-1",
      status: "confirmed",
      subtotal: 4.27,
      tax: 0.43,
      total: 4.7,
      currency: "AUD",
      tableNumber: "T05",
      items: [{ name: "Flat White", quantity: 1, unitPrice: 4.7, subtotal: 4.7 }],
    })
  })

  it("rejects payloads without an id/token", () => {
    expect(mapPlacedOrder(null)).toBeNull()
    expect(mapPlacedOrder({ order_id: "x" })).toBeNull()
    expect(mapPlacedOrder({ ...rpcResult, tracking_token: undefined })).toBeNull()
  })
})

describe("mapPlaceOrderError", () => {
  it.each([
    ["menu_item_unavailable", "menu_item_unavailable"],
    ["restaurant_not_found", "restaurant_not_found"],
    ["table_not_found", "table_not_found"],
    ["empty_cart", "empty_cart"],
    ["customer_name_required", "customer_name_required"],
    ["order_number_conflict", "order_number_conflict"],
  ])("maps %s from the Postgres message", (message, code) => {
    const error = mapPlaceOrderError({ message })
    expect(error).toBeInstanceOf(PlaceOrderError)
    expect(error.code).toBe(code)
    expect(error.message).not.toBe(message)
  })

  it("falls back to a friendly unknown error", () => {
    expect(mapPlaceOrderError({ message: "socket hang up" })).toMatchObject({
      code: "unknown",
      message: "We couldn't place your order. Please try again.",
    })
  })
})

describe("placeOrder", () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
  })

  it("sends ids and quantities only, never client prices", async () => {
    mocks.rpc.mockResolvedValue({ data: rpcResult, error: null })

    const order = await placeOrder({
      restaurantSlug: "quicktab-demo-cafe",
      tableToken: "table-token",
      customerName: "  Olivia  ",
      notes: "  extra hot  ",
      items: [
        { menuItemId: "item-1", name: "Flat White", unitPrice: 999, quantity: 2 },
      ],
    })

    expect(mocks.rpc).toHaveBeenCalledWith("place_order", {
      p_restaurant_slug: "quicktab-demo-cafe",
      p_table_token: "table-token",
      p_customer_name: "Olivia",
      p_notes: "extra hot",
      p_items: [{ menu_item_id: "item-1", quantity: 2 }],
    })
    const payload = mocks.rpc.mock.calls[0][1]
    expect(JSON.stringify(payload.p_items)).not.toContain("999")
    expect(JSON.stringify(payload.p_items)).not.toContain("Flat White")
    expect(order.customerName).toBe("Olivia")
  })

  it("rejects an empty cart without calling the RPC", async () => {
    await expect(
      placeOrder({
        restaurantSlug: "cafe",
        tableToken: "token",
        customerName: "Olivia",
        items: [],
      }),
    ).rejects.toMatchObject({ code: "empty_cart" })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("maps RPC validation errors", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "menu_item_unavailable", details: null, hint: null },
    })

    await expect(
      placeOrder({
        restaurantSlug: "cafe",
        tableToken: "token",
        customerName: "Olivia",
        items: [
          { menuItemId: "item-1", name: "Coffee", unitPrice: 4.7, quantity: 1 },
        ],
      }),
    ).rejects.toMatchObject({ code: "menu_item_unavailable" })
  })
})
