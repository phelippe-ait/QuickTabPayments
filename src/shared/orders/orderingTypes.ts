/**
 * Shared ordering shapes.
 *
 * The customer menu and the staff order-entry screen must price and group
 * lines identically, so both apps consume these types instead of maintaining
 * their own copies. They mirror the fields loaded from `menu_*` / `modifier_*`.
 */

/** A selectable option configured for a menu item. */
export type OrderingModifierOption = {
  id: string
  name: string
  priceAdjustment: number
}

/** A group of options, with the same min/max rules enforced by place_order. */
export type OrderingModifierGroup = {
  id: string
  name: string
  selectionType: "single" | "multiple"
  minSelections: number
  maxSelections: number
  isRequired: boolean
  options: OrderingModifierOption[]
}

/** A chosen modifier captured on a cart line. */
export type OrderingModifierChoice = {
  id: string
  name: string
  priceAdjustment: number
  groupName: string
}

/** A sellable item loaded from `public.menu_items`. */
export type OrderingMenuItem = {
  id: string
  name: string
  description: string
  /** GST-inclusive price, exactly as stored in the database. */
  price: number
  imageUrl: string | null
  /** Optional CSS background position retained for seeded demo imagery. */
  imagePosition?: string
  allergens: string[]
  dietaryTags: string[]
  categoryId: string
  displayOrder: number
  /** Selectable groups loaded with the menu, in display order. */
  modifierGroups?: OrderingModifierGroup[]
}

/** A menu section loaded from `public.menu_categories`, with its items. */
export type OrderingMenuCategory = {
  id: string
  name: string
  description: string
  displayOrder: number
  items: OrderingMenuItem[]
}

/** One priced cart line, shared by the customer and staff ordering flows. */
export type OrderingCartItem = {
  /** Stable key for a menu item + its selected modifier set. */
  lineId?: string
  menuItemId: string
  name: string
  baseUnitPrice?: number
  unitPrice: number
  quantity: number
  modifiers?: OrderingModifierChoice[]
}
