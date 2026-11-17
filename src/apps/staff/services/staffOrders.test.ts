import { describe, expect, it } from "vitest"
import {
  canKitchenTransition,
  kitchenStatusToOrderStatus,
  mapStaffOrder,
  mapStaffOrderError,
  nextKitchenActions,
  type StaffOrderRow,
} from "./staffOrders"

describe("mapStaffOrderError", () => {
  it("maps the transition guard error to friendly copy", () => {
    expect(mapStaffOrderError("invalid_status_transition")).toBe(
      "That status change isn't allowed. Refresh the order and try again.",
    )
  })

  it("passes unknown database errors through unchanged", () => {
    expect(mapStaffOrderError("permission denied for table orders")).toBe(
      "permission denied for table orders",
    )
  })
})

describe("nextKitchenActions", () => {
  it("offers only transitions allowed by the shared status matrix", () => {
    expect(nextKitchenActions("New")).toEqual(["Preparing", "Cancelled"])
    expect(nextKitchenActions("Preparing")).toEqual(["Ready", "Cancelled"])
    expect(nextKitchenActions("Ready")).toEqual(["Completed", "Cancelled"])
  })

  it("offers no actions once an order is closed", () => {
    expect(nextKitchenActions("Completed")).toEqual([])
    expect(nextKitchenActions("Cancelled")).toEqual([])
  })

  it("rejects illegal board transitions", () => {
    expect(canKitchenTransition("New", "Preparing")).toBe(true)
    expect(canKitchenTransition("New", "Ready")).toBe(false)
    expect(canKitchenTransition("Preparing", "Completed")).toBe(false)
    expect(canKitchenTransition("Ready", "Completed")).toBe(true)
  })

  it("maps the board's New column to a confirmed order", () => {
    expect(kitchenStatusToOrderStatus("New")).toBe("confirmed")
    expect(kitchenStatusToOrderStatus("Ready")).toBe("ready")
  })
})

describe("mapStaffOrder", () => {
  function row(overrides: Partial<StaffOrderRow> = {}): StaffOrderRow {
    return {
      id: "order-1",
      order_number: "QT-1042",
      status: "confirmed",
      total: 12.5,
      created_at: "2026-11-17T10:02:00.000Z",
      table_id: "table-1",
      restaurant_id: "restaurant-1",
      customer_name_snapshot: "Guest",
      tables: { table_number: "4" },
      order_items: [
        {
          item_name_snapshot: "Pad thai",
          quantity: 1,
          unit_price_snapshot: 12.5,
          notes: null,
          menu_items: { allergens: ["Peanuts", "Eggs"] },
        },
      ],
      payments: [],
      ...overrides,
    }
  }

  it("carries created_at and menu-item allergens onto the board order", () => {
    const mapped = mapStaffOrder(row())

    expect(mapped.createdAt).toBe("2026-11-17T10:02:00.000Z")
    expect(mapped.items[0].allergens).toEqual(["Peanuts", "Eggs"])
  })

  it("omits allergens when the menu item has none", () => {
    const mapped = mapStaffOrder(
      row({
        order_items: [
          {
            item_name_snapshot: "Flat white",
            quantity: 1,
            unit_price_snapshot: 4.5,
            notes: null,
            menu_items: { allergens: [] },
          },
        ],
      }),
    )

    expect(mapped.items[0].allergens).toBeUndefined()
  })
})
