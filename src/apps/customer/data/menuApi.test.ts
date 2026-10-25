import { describe, expect, it } from "vitest"
import type {
  MenuCategory as MenuCategoryRow,
  MenuItem as MenuItemRow,
} from "@shared/lib/database.types"
import { mapMenu, menuItemIds, toMenuItem } from "./menuApi"

const category = (
  id: string,
  name: string,
  displayOrder: number,
  isActive = true,
): MenuCategoryRow => ({
  id,
  restaurant_id: "restaurant-1",
  name,
  description: null,
  image_url: null,
  display_order: displayOrder,
  is_active: isActive,
  created_at: "2026-10-21T08:00:00Z",
})

const item = (
  id: string,
  categoryId: string,
  name: string,
  displayOrder: number,
  isAvailable = true,
  price = 4.7,
): MenuItemRow => ({
  id,
  restaurant_id: "restaurant-1",
  category_id: categoryId,
  name,
  description: `${name} description`,
  price,
  image_url: null,
  is_available: isAvailable,
  display_order: displayOrder,
  prep_time_minutes: 4,
  allergens: ["milk"],
  created_at: "2026-10-21T08:00:00Z",
  updated_at: "2026-10-21T08:00:00Z",
})

describe("mapMenu", () => {
  it("orders active categories and available items by display order", () => {
    const menu = mapMenu(
      [category("b", "Lunch", 10), category("a", "Breakfast", 0)],
      [
        item("item-late", "a", "Pancakes", 5),
        item("item-early", "a", "Toast", 1),
        item("item-b", "b", "Panini", 0),
      ],
    )

    expect(menu.map((entry) => entry.name)).toEqual(["Breakfast", "Lunch"])
    expect(menu[0].items.map((entry) => entry.name)).toEqual(["Toast", "Pancakes"])
    expect(menu[1].items[0].name).toBe("Panini")
  })

  it("drops unavailable items, inactive categories, and empty sections", () => {
    const menu = mapMenu(
      [
        category("a", "Breakfast", 0),
        category("b", "Lunch", 1),
        category("c", "Hidden", 2, false),
      ],
      [
        item("item-1", "a", "Toast", 0),
        item("item-2", "a", "Sold out", 1, false),
        item("item-3", "b", "Unavailable", 0, false),
        item("item-4", "c", "Hidden item", 0),
      ],
    )

    expect(menu).toHaveLength(1)
    expect(menu[0].id).toBe("a")
    expect(menu[0].items.map((entry) => entry.id)).toEqual(["item-1"])
  })

  it("maps database fields to the customer menu shape", () => {
    const menu = mapMenu(
      [category("a", "Drinks", 0)],
      [item("item-1", "a", "Flat White", 0, true, 4.7)],
    )

    expect(menu[0].items[0]).toMatchObject({
      id: "item-1",
      name: "Flat White",
      description: "Flat White description",
      price: 4.7,
      imageUrl: null,
      allergens: ["milk"],
      prepTimeMinutes: 4,
      categoryId: "a",
    })
  })

  it("exposes every available item id for cart reconciliation", () => {
    const menu = mapMenu(
      [category("a", "Drinks", 0), category("b", "Food", 1)],
      [
        item("item-1", "a", "Coffee", 0),
        item("item-2", "b", "Toast", 0),
      ],
    )

    expect(menuItemIds(menu)).toEqual(["item-1", "item-2"])
  })
})

describe("toMenuItem", () => {
  it("coerces numeric prices and defaults empty allergens", () => {
    const mapped = toMenuItem({ ...item("item-1", "a", "Coffee", 0), price: 5 as unknown as number, allergens: [] })
    expect(mapped.price).toBe(5)
    expect(mapped.allergens).toEqual([])
  })
})
