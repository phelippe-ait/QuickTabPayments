import { describe, expect, it } from "vitest"
import { toHistoryOrder } from "./orderHistory"

type HistoryRow = Parameters<typeof toHistoryOrder>[0]

function row(overrides: Record<string, unknown> = {}): HistoryRow {
  return {
    id: "order-1",
    order_number: "QT-261117-0009",
    status: "completed",
    subtotal: 8.54,
    tax: 0.86,
    total: 9.4,
    tip_amount: 1,
    notes: "No sauce",
    created_at: "2026-11-17T09:03:42.000Z",
    tables: { table_number: "4" },
    payments: [{ status: "succeeded" }],
    order_items: [
      {
        item_name_snapshot: "Flat White",
        quantity: 2,
        unit_price_snapshot: 4.7,
        notes: null,
        order_item_modifiers: [{ modifier_name_snapshot: "Oat milk" }],
        menu_items: { allergens: ["Milk"] },
      },
    ],
    ...overrides,
  } as unknown as HistoryRow
}

describe("toHistoryOrder", () => {
  it("maps items from order_items, not the free-text notes", () => {
    const order = toHistoryOrder(row())

    expect(order.items).toEqual([
      {
        name: "Flat White",
        qty: 2,
        price: 4.7,
        modifiers: ["Oat milk"],
        allergens: ["Milk"],
      },
    ])
    expect(order.items.reduce((sum, item) => sum + item.qty, 0)).toBe(2)
  })

  it("falls back to legacy notes JSON when order_items is empty", () => {
    const order = toHistoryOrder(
      row({
        order_items: [],
        notes: JSON.stringify({
          items: [{ name: "Latte", unitPrice: 4.5, quantity: 1 }],
        }),
      }),
    )

    expect(order.items).toEqual([{ name: "Latte", qty: 1, price: 4.5 }])
  })

  it("treats non-JSON customer notes as having no items", () => {
    const order = toHistoryOrder(row({ order_items: [], notes: "Extra hot" }))

    expect(order.items).toEqual([])
  })
})
