import { describe, expect, it } from "vitest"
import type { MenuItem } from "../types"
import { buildReorderCart, type ReorderSourceItem } from "./reorder"
import { buildOrderItemKey } from "./orderItemKey"

const flatWhite: MenuItem = {
  id: "item-1",
  name: "Flat White",
  description: "",
  price: 5,
  imageUrl: null,
  allergens: [],
  dietaryTags: [],
  categoryId: "category-1",
  displayOrder: 0,
  modifierGroups: [
    {
      id: "group-size",
      name: "Cup size",
      selectionType: "single",
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      options: [
        { id: "size-regular", name: "Regular", priceAdjustment: 0 },
        { id: "size-large", name: "Large", priceAdjustment: 1.5 },
      ],
    },
    {
      id: "group-milk",
      name: "Milk",
      selectionType: "single",
      minSelections: 0,
      maxSelections: 1,
      isRequired: false,
      options: [
        { id: "milk-oat", name: "Oat milk", priceAdjustment: 0.5 },
      ],
    },
  ],
}

const pastFlatWhite: ReorderSourceItem = {
  menuItemId: "item-1",
  name: "Flat White (old name)",
  quantity: 2,
  unitPrice: 4.7,
  subtotal: 9.4,
  modifiers: [
    { id: "size-large", name: "Large", priceAdjustment: 1 },
    { id: "milk-oat", name: "Oat milk", priceAdjustment: 0.5 },
  ],
}

describe("buildReorderCart", () => {
  it("rebuilds lines from the current menu, keeping valid modifiers", () => {
    const result = buildReorderCart([pastFlatWhite], [flatWhite])

    expect(result.skipped).toEqual([])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      menuItemId: "item-1",
      name: "Flat White",
      quantity: 2,
      baseUnitPrice: 5,
      unitPrice: 7,
      lineId: buildOrderItemKey("item-1", ["size-large", "milk-oat"]),
      modifiers: [
        {
          id: "size-large",
          name: "Large",
          priceAdjustment: 1.5,
          groupName: "Cup size",
        },
        {
          id: "milk-oat",
          name: "Oat milk",
          priceAdjustment: 0.5,
          groupName: "Milk",
        },
      ],
    })
  })

  it("takes prices from the current menu, not the order snapshots", () => {
    const result = buildReorderCart(
      [
        {
          ...pastFlatWhite,
          unitPrice: 1,
          subtotal: 2,
          modifiers: [
            { id: "size-large", name: "Large", priceAdjustment: 0.1 },
          ],
        },
      ],
      [flatWhite],
    )

    expect(result.items[0]).toMatchObject({ unitPrice: 6.5, baseUnitPrice: 5 })
  })

  it("skips menu items that are no longer available", () => {
    const result = buildReorderCart(
      [
        {
          menuItemId: "item-gone",
          name: "Old Muffin",
          quantity: 2,
          unitPrice: 3,
          subtotal: 6,
        },
      ],
      [flatWhite],
    )

    expect(result.items).toEqual([])
    expect(result.skipped).toEqual([
      { name: "Old Muffin", quantity: 2, reason: "No longer available" },
    ])
  })

  it("drops deleted optional modifiers and notes the change", () => {
    const result = buildReorderCart(
      [
        {
          ...pastFlatWhite,
          modifiers: [
            { id: "size-large", name: "Large", priceAdjustment: 1 },
            { id: "milk-soy", name: "Soy milk", priceAdjustment: 0.5 },
          ],
        },
      ],
      [flatWhite],
    )

    expect(result.items[0]).toMatchObject({
      menuItemId: "item-1",
      unitPrice: 6.5,
      modifiers: [{ id: "size-large", name: "Large" }],
    })
    expect(result.skipped).toEqual([
      {
        name: "Flat White",
        quantity: 2,
        reason: "Soy milk unavailable — added without it",
      },
    ])
  })

  it("skips an item when a required group loses its only choice", () => {
    const withoutLarge: MenuItem = {
      ...flatWhite,
      modifierGroups: [
        {
          ...flatWhite.modifierGroups![0],
          options: [
            { id: "size-regular", name: "Regular", priceAdjustment: 0 },
          ],
        },
      ],
    }

    const result = buildReorderCart(
      [
        {
          ...pastFlatWhite,
          modifiers: [
            { id: "size-large", name: "Large", priceAdjustment: 1 },
          ],
        },
      ],
      [withoutLarge],
    )

    expect(result.items).toEqual([])
    expect(result.skipped).toEqual([
      {
        name: "Flat White",
        quantity: 2,
        reason: "Required choice for Cup size is no longer available",
      },
    ])
  })

  it("folds repeated item + modifier combinations into one line", () => {
    const result = buildReorderCart(
      [pastFlatWhite, { ...pastFlatWhite, quantity: 1 }],
      [flatWhite],
    )

    expect(result.items).toHaveLength(1)
    expect(result.items[0].quantity).toBe(3)
  })

  it("returns an empty cart for an empty order", () => {
    expect(buildReorderCart([], [flatWhite])).toEqual({
      items: [],
      skipped: [],
    })
  })
})
