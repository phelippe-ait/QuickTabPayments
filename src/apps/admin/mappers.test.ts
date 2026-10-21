import { describe, expect, it } from "vitest"
import type { MenuCategory, MenuItem as DbMenuItem } from "@shared/lib/database.types"
import { toCategoryVM, toMenuItemVM } from "./mappers"

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
