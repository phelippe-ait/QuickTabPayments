import { describe, expect, it } from "vitest"
import type { OrderingMenuItem } from "@shared/orders/orderingTypes"
import {
  addStaffLine,
  removeStaffLine,
  setStaffLineQuantity,
  staffCartCount,
  staffCartTotal,
  toStaffOrderItems,
} from "./orderCart"

const latte: OrderingMenuItem = {
  id: "item-latte",
  name: "Latte",
  description: "",
  price: 4.5,
  imageUrl: null,
  allergens: [],
  dietaryTags: [],
  categoryId: "drinks",
  displayOrder: 0,
}

const extraShot = {
  id: "mod-shot",
  name: "Extra shot",
  priceAdjustment: 0.8,
  groupName: "Extras",
}

describe("staff order cart", () => {
  it("merges identical item + modifier lines", () => {
    const first = addStaffLine([], latte, 1, [extraShot])
    const merged = addStaffLine(first, latte, 2, [extraShot])

    expect(merged).toHaveLength(1)
    expect(merged[0].quantity).toBe(3)
    expect(merged[0].unitPrice).toBe(5.3)
  })

  it("keeps different modifier sets as separate lines", () => {
    const lines = addStaffLine(
      addStaffLine([], latte, 1),
      latte,
      1,
      [extraShot],
    )

    expect(lines).toHaveLength(2)
    expect(lines.map((line) => line.unitPrice)).toEqual([4.5, 5.3])
  })

  it("updates and removes lines, and totals include every quantity", () => {
    const lines = addStaffLine(
      addStaffLine([], latte, 2),
      latte,
      1,
      [extraShot],
    )

    expect(staffCartCount(lines)).toBe(3)
    expect(staffCartTotal(lines)).toBe(14.3)

    const updated = setStaffLineQuantity(lines, lines[0].lineId, 5)
    expect(updated[0].quantity).toBe(5)

    const removed = removeStaffLine(updated, updated[0].lineId)
    expect(removed).toHaveLength(1)

    expect(setStaffLineQuantity(lines, lines[0].lineId, 0)).toHaveLength(1)
  })

  it("sends only ids, quantities and modifiers to the RPC", () => {
    const lines = addStaffLine(
      addStaffLine([], latte, 2),
      latte,
      1,
      [extraShot],
    )

    expect(toStaffOrderItems(lines)).toEqual([
      { menu_item_id: "item-latte", quantity: 2 },
      {
        menu_item_id: "item-latte",
        quantity: 1,
        modifiers: ["mod-shot"],
      },
    ])
  })
})
