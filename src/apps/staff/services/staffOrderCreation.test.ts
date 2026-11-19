import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createStaffOrder,
  mapStaffOrderError,
  mapStaffPlacedOrder,
  StaffOrderError,
} from "./staffOrderCreation"

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock("@shared/data/client", () => ({
  requireSupabase: () => ({ rpc: mocks.rpc }),
}))

describe("createStaffOrder", () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
  })

  it("calls staff_place_order with ids, guest and table", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        order_id: "order-1",
        order_number: "QT-261119-0001",
        status: "confirmed",
        subtotal: 4.09,
        tax: 0.41,
        total: 4.5,
        currency: "AUD",
        restaurant_name: "Demo Cafe",
        table_number: "4",
        customer_name: "Ada",
        paid: false,
        created_at: "2026-11-19T08:00:00Z",
      },
      error: null,
    })

    const order = await createStaffOrder({
      tableId: "table-1",
      customerName: "  Ada  ",
      notes: "  no onions ",
      items: [
        { menu_item_id: "item-1", quantity: 1, modifiers: ["mod-1"] },
      ],
      paid: false,
    })

    expect(mocks.rpc).toHaveBeenCalledWith("staff_place_order", {
      p_table_id: "table-1",
      p_customer_name: "Ada",
      p_notes: "no onions",
      p_items: [
        { menu_item_id: "item-1", quantity: 1, modifiers: ["mod-1"] },
      ],
      p_paid: false,
    })
    expect(order).toMatchObject({
      orderId: "order-1",
      orderNumber: "QT-261119-0001",
      status: "confirmed",
      tableNumber: "4",
      customerName: "Ada",
      paid: false,
    })
  })

  it("rejects an empty cart or missing name before calling the RPC", async () => {
    await expect(
      createStaffOrder({
        tableId: null,
        customerName: "Ada",
        items: [],
        paid: false,
      }),
    ).rejects.toMatchObject({ code: "empty_cart" })

    await expect(
      createStaffOrder({
        tableId: null,
        customerName: " ",
        items: [{ menu_item_id: "item-1", quantity: 1 }],
        paid: false,
      }),
    ).rejects.toMatchObject({ code: "customer_name_required" })

    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("maps RPC errors to staff-facing copy", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "menu_item_unavailable" },
    })

    await expect(
      createStaffOrder({
        tableId: null,
        customerName: "Ada",
        items: [{ menu_item_id: "item-1", quantity: 1 }],
        paid: true,
      }),
    ).rejects.toBeInstanceOf(StaffOrderError)
  })
})

describe("staff order mapping", () => {
  it("treats a missing table as a counter order", () => {
    const mapped = mapStaffPlacedOrder({
      order_id: "order-1",
      order_number: "QT-1",
      status: "confirmed",
      subtotal: 0,
      tax: 0,
      total: 0,
      table_number: null,
      customer_name: "Ada",
      paid: true,
    })

    expect(mapped?.tableNumber).toBeNull()
    expect(mapped?.paid).toBe(true)
  })

  it("finds known and unknown error codes", () => {
    expect(mapStaffOrderError({ message: "not_authorised" }).code).toBe(
      "not_authorised",
    )
    expect(mapStaffOrderError({ message: "boom" }).code).toBe("unknown")
  })
})
