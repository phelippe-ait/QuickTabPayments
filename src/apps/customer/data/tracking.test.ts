import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchOrderTracking,
  isTerminalStatus,
  mapTracking,
  trackingUrl,
} from "./tracking"

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@shared/data/client", () => ({
  requireSupabase: () => ({ rpc: mocks.rpc }),
}))

const row = {
  order_id: "order-1",
  order_number: "QT-261025-0001",
  status: "preparing",
  subtotal: 4.27,
  tax: 0.43,
  total: 4.7,
  currency: "AUD",
  created_at: "2026-10-25T02:00:00Z",
  pickup_time_estimate: "2026-10-25T02:10:00Z",
  table_number: "T05",
  restaurant_name: "QuickTab Demo Cafe",
  items: [{ name: "Flat White", quantity: 1, unit_price: 4.7, subtotal: 4.7 }],
}

describe("mapTracking", () => {
  it("maps the limited tracking payload", () => {
    expect(mapTracking(row)).toMatchObject({
      orderId: "order-1",
      orderNumber: "QT-261025-0001",
      status: "preparing",
      tableNumber: "T05",
      restaurantName: "QuickTab Demo Cafe",
      items: [{ name: "Flat White", quantity: 1, unitPrice: 4.7, subtotal: 4.7 }],
    })
  })

  it("returns null for an unknown token", () => {
    expect(mapTracking(null)).toBeNull()
    expect(mapTracking({})).toBeNull()
  })
})

describe("fetchOrderTracking", () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
  })

  it("returns null without calling the RPC for a missing token", async () => {
    expect(await fetchOrderTracking("   ")).toBeNull()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("sends the token to the RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: row, error: null })
    const order = await fetchOrderTracking(" token-1 ")
    expect(mocks.rpc).toHaveBeenCalledWith("get_order_tracking", {
      p_token: "token-1",
    })
    expect(order?.orderNumber).toBe("QT-261025-0001")
  })

  it("throws a safe error when the RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } })
    await expect(fetchOrderTracking("token")).rejects.toThrow(
      "Could not load this order. Please try again.",
    )
  })
})

describe("tracking helpers", () => {
  it("stops at terminal statuses", () => {
    expect(isTerminalStatus("completed")).toBe(true)
    expect(isTerminalStatus("cancelled")).toBe(true)
    expect(isTerminalStatus("ready")).toBe(false)
  })

  it("builds a deep-linkable tracking URL", () => {
    expect(
      trackingUrl("QT-261025-0001", "token-1", "https://quicktab.example"),
    ).toBe("/order/QT-261025-0001?token=token-1")
  })
})
