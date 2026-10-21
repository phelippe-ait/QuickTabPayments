import type {
  MenuCategory,
  MenuItem as DbMenuItem,
} from "@shared/lib/database.types"
import type { CategoryVM, MenuItemVM } from "./types"

/**
 * Database rows → admin view models. Keep this free of React so the mapping
 * can be unit-tested and reused by hooks.
 */

export function toCategoryVM(row: MenuCategory): CategoryVM {
  return {
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
  }
}

export function toMenuItemVM(
  row: DbMenuItem,
  categories: MenuCategory[],
): MenuItemVM {
  const category = categories.find((entry) => entry.id === row.category_id)

  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    categoryName: category?.name ?? "Uncategorized",
    description: row.description ?? "",
    price: row.price,
    imageUrl: row.image_url,
    isAvailable: row.is_available,
    displayOrder: row.display_order,
  }
}
