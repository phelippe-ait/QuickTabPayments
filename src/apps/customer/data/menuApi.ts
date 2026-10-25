import { requireSupabase } from "@shared/data/client"
import type { MenuCategory as MenuCategoryRow, MenuItem as MenuItemRow } from "@shared/lib/database.types"
import type { MenuCategory, MenuItem } from "../types"

function compareOrder(
  a: { display_order: number; name: string },
  b: { display_order: number; name: string },
): number {
  if (a.display_order !== b.display_order) return a.display_order - b.display_order
  return a.name.localeCompare(b.name)
}

type CustomerMenuItemRow = Pick<
  MenuItemRow,
  | "id"
  | "category_id"
  | "name"
  | "description"
  | "price"
  | "image_url"
  | "is_available"
  | "display_order"
  | "allergens"
>

export function toMenuItem(row: CustomerMenuItemRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price),
    imageUrl: row.image_url,
    allergens: row.allergens ?? [],
    categoryId: row.category_id,
    displayOrder: row.display_order,
  }
}

/**
 * Pure mapper: active categories in `display_order`, available items grouped
 * beneath them. Categories with no available items are omitted so the customer
 * never sees an empty section.
 */
export function mapMenu(
  categoryRows: MenuCategoryRow[],
  itemRows: CustomerMenuItemRow[],
): MenuCategory[] {
  const categories = categoryRows
    .filter((row) => row.is_active)
    .slice()
    .sort(compareOrder)

  const itemsByCategory = new Map<string, MenuItem[]>()
  for (const row of itemRows) {
    if (!row.is_available) continue
    const list = itemsByCategory.get(row.category_id) ?? []
    list.push(toMenuItem(row))
    itemsByCategory.set(row.category_id, list)
  }

  return categories.flatMap((category) => {
    const items = (itemsByCategory.get(category.id) ?? [])
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
    if (items.length === 0) return []
    return [
      {
        id: category.id,
        name: category.name,
        description: category.description ?? "",
        displayOrder: category.display_order,
        items,
      },
    ]
  })
}

export async function fetchMenu(restaurantId: string): Promise<MenuCategory[]> {
  const client = requireSupabase()

  const [categoriesResult, itemsResult] = await Promise.all([
    client
      .from("menu_categories")
      .select("id, name, description, image_url, display_order, is_active, restaurant_id, created_at")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    client
      .from("menu_items")
      .select(
        "id, restaurant_id, category_id, name, description, price, image_url, is_available, display_order, allergens, created_at, updated_at",
      )
      .eq("restaurant_id", restaurantId)
      .eq("is_available", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
  ])

  if (categoriesResult.error) {
    console.error("Could not load menu categories", categoriesResult.error)
    throw new Error("Could not load the menu. Please try again.")
  }
  if (itemsResult.error) {
    console.error("Could not load menu items", itemsResult.error)
    throw new Error("Could not load the menu. Please try again.")
  }

  return mapMenu(categoriesResult.data ?? [], itemsResult.data ?? [])
}

/** All item ids currently offered by the menu (used to reconcile the cart). */
export function menuItemIds(menu: MenuCategory[]): string[] {
  return menu.flatMap((category) => category.items.map((item) => item.id))
}
