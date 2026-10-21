import { describe, expect, it } from "vitest"
import type { MenuCategory, MenuItem as DbMenuItem } from "@shared/lib/database.types"
import type { OrderWithDetails } from "@shared/data/orders"
import { toCategoryVM, toMenuItemVM, toOrderVM } from "./mappers"

const category: MenuCategory = {
  id: "cat-1",
  restaurant_id: "restaurant-1",
  name: "Hot Beverages",
  description: null,
  image_url: null,
  display_order: 2,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
}

const item: DbMenuItem = {
  id: "item-1",
  restaurant_id: "restaurant-1",
  category_id: "cat-1",
  name: "Flat White",
  description: "Smooth and creamy",
  price: 4.7,
  image_url: "https://example.test/flat-white.webp",
  is_available: true,
  display_order: 3,
  prep_time_minutes: 10,
  allergens: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

describe("toCategoryVM", () => {
  it("maps database columns to the view model", () => {
    expect(toCategoryVM(category)).toEqual({
      id: "cat-1",
      name: "Hot Beverages",
      displayOrder: 2,
    })
  })
})

describe("toMenuItemVM", () => {
  it("joins the category name and preserves numeric prices", () => {
    const vm = toMenuItemVM(item, [category])

    expect(vm).toEqual({
      id: "item-1",
      name: "Flat White",
      categoryId: "cat-1",
      categoryName: "Hot Beverages",
      description: "Smooth and creamy",
      price: 4.7,
      imageUrl: "https://example.test/flat-white.webp",
      isAvailable: true,
      displayOrder: 3,
    })
  })

  it("falls back to a readable category label and empty description", () => {
    const vm = toMenuItemVM(
      { ...item, category_id: "missing", description: null },
      [category],
    )

    expect(vm.categoryName).toBe("Uncategorized")
    expect(vm.description).toBe("")
  })
})

const orderRow: OrderWithDetails = {
  id: "order-1",
  restaurant_id: "restaurant-1",
  table_id: "table-1",
  customer_id: null,
  customer_name_snapshot: "Olivia Moore",
  order_number: "1048",
  status: "preparing",
  subtotal: 12.4,
  tax: 1.24,
  total: 13.64,
  notes: null,
  pickup_time_estimate: null,
  created_at: "2026-10-21T08:30:00Z",
  updated_at: "2026-10-21T08:30:00Z",
  completed_at: null,
  tables: { table_number: "T02" },
  order_items: [
    {
      id: "line-1",
      order_id: "order-1",
      menu_item_id: "item-1",
      item_name_snapshot: "Flat White",
      unit_price_snapshot: 4.7,
      quantity: 2,
      subtotal: 9.4,
      notes: null,
      menu_items: { image_url: "https://example.test/flat-white.webp" },
    },
  ],
  payments: [
    {
      id: "payment-1",
      order_id: "order-1",
      stripe_payment_intent_id: null,
      status: "succeeded",
      amount: 13.64,
      currency: "AUD",
      payment_method_type: "card",
      receipt_url: null,
      failure_reason: null,
      paid_at: "2026-10-21T08:30:05Z",
      created_at: "2026-10-21T08:30:00Z",
      updated_at: "2026-10-21T08:30:05Z",
    },
  ],
}

describe("toOrderVM", () => {
  it("maps snapshots, payments, and ISO timestamps", () => {
    const vm = toOrderVM(orderRow, {
      currency: "AUD",
      timezone: "Australia/Sydney",
    })

    expect(vm.orderNumber).toBe("1048")
    expect(vm.customerName).toBe("Olivia Moore")
    expect(vm.tableNumber).toBe("T02")
    expect(vm.lineItems[0]).toEqual({
      id: "line-1",
      name: "Flat White",
      quantity: 2,
      unitPrice: 4.7,
      subtotal: 9.4,
      imageUrl: "https://example.test/flat-white.webp",
      notes: null,
    })
    expect(vm.payments[0]?.method).toBe("Card")
    expect(vm.createdAt).toBe("2026-10-21T08:30:00Z")
    expect(vm.createdAtLabel).toContain("2026")
  })

  it("falls back to Guest and zero refunds", () => {
    const vm = toOrderVM(
      { ...orderRow, customer_name_snapshot: null },
      { currency: "AUD", timezone: "UTC" },
    )

    expect(vm.customerName).toBe("Guest")
    expect(vm.refundedTotal).toBe(0)
  })
})
