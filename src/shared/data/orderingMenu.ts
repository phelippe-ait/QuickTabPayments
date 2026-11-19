import { requireSupabase } from "./client"
import type {
  MenuCategory as MenuCategoryRow,
  MenuItem as MenuItemRow,
  MenuItemModifierGroup as ModifierLinkRow,
  Modifier as ModifierRow,
  ModifierGroup as ModifierGroupRow,
} from "@shared/lib/database.types"
import type {
  OrderingMenuCategory,
  OrderingMenuItem,
  OrderingModifierGroup,
} from "@shared/orders/orderingTypes"

function compareOrder(
  a: { display_order: number; name: string },
  b: { display_order: number; name: string },
): number {
  if (a.display_order !== b.display_order) return a.display_order - b.display_order
  return a.name.localeCompare(b.name)
}

type OrderingMenuItemRow = Pick<
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
  | "dietary_tags"
>

type ModifierLink = Pick<
  ModifierLinkRow,
  "menu_item_id" | "modifier_group_id" | "display_order"
>

type ModifierGroupRowData = Pick<
  ModifierGroupRow,
  | "id"
  | "name"
  | "selection_type"
  | "min_selections"
  | "max_selections"
  | "is_required"
  | "display_order"
>

type ModifierRowData = Pick<
  ModifierRow,
  | "id"
  | "modifier_group_id"
  | "name"
  | "price_adjustment"
  | "display_order"
  | "is_available"
>

export function toMenuItem(
  row: OrderingMenuItemRow,
  modifierGroups: OrderingModifierGroup[] = [],
): OrderingMenuItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price),
    imageUrl: row.image_url,
    allergens: row.allergens ?? [],
    dietaryTags: row.dietary_tags ?? [],
    categoryId: row.category_id,
    displayOrder: row.display_order,
    modifierGroups,
  }
}

/**
 * Pure mapper for the M:N modifier join. Groups keep the item's link order,
 * options keep `display_order`/name order, and unavailable modifiers are
 * dropped (RLS already hides them, but the filter keeps the mapper honest).
 */
export function mapModifierGroupsByItem(
  links: ModifierLink[],
  groups: ModifierGroupRowData[],
  modifiers: ModifierRowData[],
): Map<string, OrderingModifierGroup[]> {
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const optionsByGroup = new Map<string, OrderingModifierGroup["options"]>()
  const orderedModifiers = modifiers
    .filter((modifier) => modifier.is_available)
    .slice()
    .sort(compareOrder)

  for (const modifier of orderedModifiers) {
    const options = optionsByGroup.get(modifier.modifier_group_id) ?? []
    options.push({
      id: modifier.id,
      name: modifier.name,
      priceAdjustment: Number(modifier.price_adjustment),
    })
    optionsByGroup.set(modifier.modifier_group_id, options)
  }

  const byItem = new Map<string, OrderingModifierGroup[]>()
  const orderedLinks = links
    .slice()
    .sort((a, b) => a.display_order - b.display_order)

  for (const link of orderedLinks) {
    const group = groupById.get(link.modifier_group_id)
    if (!group) continue

    const list = byItem.get(link.menu_item_id) ?? []
    if (list.some((entry) => entry.id === group.id)) continue

    list.push({
      id: group.id,
      name: group.name,
      selectionType: group.selection_type,
      minSelections: group.min_selections,
      maxSelections: group.max_selections,
      isRequired: group.is_required,
      options: optionsByGroup.get(group.id) ?? [],
    })
    byItem.set(link.menu_item_id, list)
  }

  return byItem
}

/**
 * Pure mapper: active categories in `display_order`, available items grouped
 * beneath them. Categories with no available items are omitted so the menu
 * never shows an empty section.
 */
export function mapMenu(
  categoryRows: MenuCategoryRow[],
  itemRows: OrderingMenuItemRow[],
  modifierGroupsByItem: Map<string, OrderingModifierGroup[]> = new Map(),
): OrderingMenuCategory[] {
  const categories = categoryRows
    .filter((row) => row.is_active)
    .slice()
    .sort(compareOrder)

  const itemsByCategory = new Map<string, OrderingMenuItem[]>()
  for (const row of itemRows) {
    if (!row.is_available) continue
    const list = itemsByCategory.get(row.category_id) ?? []
    list.push(toMenuItem(row, modifierGroupsByItem.get(row.id) ?? []))
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

/**
 * Load the modifier groups (and their available options) for the given menu
 * items in three batched queries, joined on `menu_item_modifier_groups`.
 */
async function fetchModifierGroupsForItems(
  menuItemIds: string[],
): Promise<Map<string, OrderingModifierGroup[]>> {
  if (menuItemIds.length === 0) return new Map()

  const client = requireSupabase()
  const { data: links, error: linkError } = await client
    .from("menu_item_modifier_groups")
    .select("menu_item_id, modifier_group_id, display_order")
    .in("menu_item_id", menuItemIds)
    .order("display_order", { ascending: true })

  if (linkError) {
    console.error("Could not load item modifier groups", linkError)
    throw new Error("Could not load the menu. Please try again.")
  }
  if (!links?.length) return new Map()

  const groupIds = [...new Set(links.map((link) => link.modifier_group_id))]
  const [{ data: groups, error: groupError }, { data: modifiers, error: modifierError }] =
    await Promise.all([
      client
        .from("modifier_groups")
        .select("id, name, selection_type, min_selections, max_selections, is_required, display_order")
        .in("id", groupIds)
        .order("display_order", { ascending: true }),
      client
        .from("modifiers")
        .select("id, modifier_group_id, name, price_adjustment, display_order, is_available")
        .in("modifier_group_id", groupIds)
        .eq("is_available", true)
        .order("display_order", { ascending: true }),
    ])

  if (groupError || modifierError) {
    console.error(
      "Could not load item modifier options",
      groupError ?? modifierError,
    )
    throw new Error("Could not load the menu. Please try again.")
  }

  return mapModifierGroupsByItem(links, groups ?? [], modifiers ?? [])
}

/** Load every active category, available item and selectable option. */
export async function fetchOrderingMenu(
  restaurantId: string,
): Promise<OrderingMenuCategory[]> {
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
        "id, restaurant_id, category_id, name, description, price, image_url, is_available, display_order, allergens, dietary_tags, created_at, updated_at",
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

  const itemRows = itemsResult.data ?? []
  const modifierGroupsByItem = await fetchModifierGroupsForItems(
    itemRows.map((row) => row.id),
  )

  return mapMenu(categoriesResult.data ?? [], itemRows, modifierGroupsByItem)
}

/** Load one item's live modifier groups; kept for focused refreshes. */
export async function fetchItemModifierGroups(
  menuItemId: string,
): Promise<OrderingModifierGroup[]> {
  const byItem = await fetchModifierGroupsForItems([menuItemId])
  return byItem.get(menuItemId) ?? []
}

/** All item ids currently offered by the menu (used to reconcile a cart). */
export function menuItemIds(menu: OrderingMenuCategory[]): string[] {
  return menu.flatMap((category) => category.items.map((item) => item.id))
}
